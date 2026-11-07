import { createClient } from '@supabase/supabase-js';
import express from 'express';
import Stripe from 'stripe';

const API_PREFIX = '/api/v1';
const GYM_SELECT = `
  id,name,area,address,monthly,day,category,description,hours,image,featured,sample,contact_url,sort_order,
  gym_equipment(equipment(name)),gym_amenities(amenities(name))
`;

class RequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function createSupabase(key, accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return createClient(requiredEnv('SUPABASE_URL'), key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: headers ? { headers } : undefined,
  });
}

function publicSupabase() {
  return createSupabase(requiredEnv('SUPABASE_ANON_KEY'));
}

function adminSupabase() {
  return createSupabase(requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function userSupabase(accessToken) {
  return createSupabase(requiredEnv('SUPABASE_ANON_KEY'), accessToken);
}

function stripeClient() {
  return new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
}

function parseList(parameters, key, maxItems) {
  const values = parameters.getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length > maxItems) {
    throw new RequestError(400, 'INVALID_QUERY', `Use no more than ${maxItems} ${key} values.`);
  }
  return [...new Set(values)];
}

function parseGymFilters(parameters) {
  const allowed = new Set(['q', 'budget', 'equipment', 'amenities', 'sort', 'featured', 'ids']);
  for (const key of parameters.keys()) {
    if (!allowed.has(key)) throw new RequestError(400, 'INVALID_QUERY', `Unknown query parameter: ${key}.`);
  }
  const query = parameters.get('q')?.trim() || '';
  if (query.length > 100) throw new RequestError(400, 'INVALID_QUERY', 'Search text must be 100 characters or fewer.');

  const budgetValue = parameters.get('budget');
  let budget;
  if (budgetValue !== null) {
    budget = Number(budgetValue);
    if (!budgetValue.trim() || !Number.isSafeInteger(budget) || budget < 0 || budget > 100000) {
      throw new RequestError(400, 'INVALID_QUERY', 'Budget must be a whole number between 0 and 100000.');
    }
  }

  const sort = parameters.get('sort') || 'featured';
  if (!['featured', 'low', 'high'].includes(sort)) {
    throw new RequestError(400, 'INVALID_QUERY', 'Sort must be featured, low, or high.');
  }
  const featuredValue = parameters.get('featured');
  if (featuredValue !== null && !['true', 'false'].includes(featuredValue)) {
    throw new RequestError(400, 'INVALID_QUERY', 'Featured must be true or false.');
  }
  const ids = parseList(parameters, 'ids', 100);
  if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
    throw new RequestError(400, 'INVALID_QUERY', 'Gym IDs must be lowercase slugs.');
  }
  return {
    query: query.toLocaleLowerCase(),
    budget,
    equipment: parseList(parameters, 'equipment', 20),
    amenities: parseList(parameters, 'amenities', 20),
    sort,
    featured: featuredValue === null ? undefined : featuredValue === 'true',
    ids: ids.length ? ids : undefined,
  };
}

function serializeGym(row) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    monthly: row.monthly,
    day: row.day,
    category: row.category,
    description: row.description,
    equipment: (row.gym_equipment || []).map((link) => link.equipment?.name).filter(Boolean).sort(),
    amenities: (row.gym_amenities || []).map((link) => link.amenities?.name).filter(Boolean).sort(),
    hours: row.hours,
    image: row.image,
    featured: row.featured,
    sample: row.sample,
    contactUrl: row.contact_url,
  };
}

function matchesGym(gym, filters) {
  const matchesText = !filters.query
    || [gym.name, gym.area, gym.category].some((value) => value.toLocaleLowerCase().includes(filters.query));
  return matchesText
    && (filters.budget === undefined || gym.monthly <= filters.budget)
    && (filters.featured === undefined || gym.featured === filters.featured)
    && (!filters.ids || filters.ids.includes(gym.id))
    && filters.equipment.every((name) => gym.equipment.includes(name))
    && filters.amenities.every((name) => gym.amenities.includes(name));
}

function sortGyms(gyms, sort) {
  return gyms.sort((left, right) => {
    if (sort === 'low' && left.monthly !== right.monthly) return left.monthly - right.monthly;
    if (sort === 'high' && left.monthly !== right.monthly) return right.monthly - left.monthly;
    if (sort === 'featured' && left.featured !== right.featured) {
      return Number(right.featured) - Number(left.featured);
    }
    return left.sortOrder - right.sortOrder;
  });
}

function sendError(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

function sendSupabaseError(error, response, logger, context) {
  if (error instanceof RequestError) {
    sendError(response, error.status, error.code, error.message);
    return;
  }
  logger.error(`${context}:`, error);
  sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
}

function bearerToken(request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.get('authorization') || '');
  return match?.[1];
}

function validateString(value, label, maxLength, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.trim().length > maxLength || (!optional && !value.trim())) {
    throw new RequestError(400, 'INVALID_INPUT', `${label} is required and must be no more than ${maxLength} characters.`);
  }
  return value.trim();
}

function validateHttpsUrl(value, label) {
  const url = validateString(value, label, 2048);
  if (!URL.canParse(url) || new URL(url).protocol !== 'https:') {
    throw new RequestError(400, 'INVALID_INPUT', `${label} must be a valid HTTPS URL.`);
  }
  return url;
}

function mapDatabaseError(error) {
  const message = error?.message || '';
  if (message.includes('Monthly trainer request limit reached')) {
    return new RequestError(429, 'REQUEST_LIMIT_REACHED', 'You have reached this month’s trainer request limit. Upgrade to Premium for up to 20 requests per month.');
  }
  if (message.includes('A connection request already exists')) {
    return new RequestError(409, 'CONNECTION_EXISTS', 'You already have a pending or accepted connection with this trainer.');
  }
  if (message.includes('Trainer connection must be accepted first')) {
    return new RequestError(403, 'CONNECTION_REQUIRED', 'Connect with this trainer before requesting a session.');
  }
  if (message.includes('Requested time is not within the trainer availability')) {
    return new RequestError(400, 'UNAVAILABLE_TIME', 'Choose a time within the trainer’s listed availability.');
  }
  if (message.includes('Request is no longer pending')) {
    return new RequestError(409, 'REQUEST_NOT_PENDING', 'This request has already been updated.');
  }
  if (message.includes('not authorized') || message.includes('Not authorized')) {
    return new RequestError(403, 'FORBIDDEN', 'You are not allowed to perform this action.');
  }
  if (message.includes('Trainer is not available')) {
    return new RequestError(404, 'TRAINER_NOT_FOUND', 'This trainer is unavailable.');
  }
  if (message.includes('Authentication required')) {
    return new RequestError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
  }
  if (message.includes('Only gym-goer accounts can contact trainers')
    || message.includes('Trainer account required')
    || message.includes('Admin access required')) {
    return new RequestError(403, 'ROLE_REQUIRED', 'Your account does not have permission to perform this action.');
  }
  if (message.includes('Session time is already booked')) {
    return new RequestError(409, 'SESSION_TIME_TAKEN', 'That session time has already been accepted for another request.');
  }
  if (message.includes('Too many inquiries')) {
    return new RequestError(429, 'INQUIRY_LIMIT_REACHED', 'Too many inquiries were submitted. Please try again later.');
  }
  if (message.includes('Invalid inquiry details') || message.includes('Consent is required')) {
    return new RequestError(400, 'INVALID_INPUT', 'Check the inquiry details and provide consent before submitting.');
  }
  if (message.includes('Availability timezone is invalid')
    || message.includes('Provide a valid weekly availability schedule')) {
    return new RequestError(400, 'INVALID_AVAILABILITY', 'Provide a valid weekly availability schedule.');
  }
  return error;
}

export function createApp({ logger = console } = {}) {
  const app = express();
  const allowedOrigins = new Set((process.env.CORS_ORIGINS || '')
    .split(',').map((origin) => origin.trim()).filter(Boolean));
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((request, response, next) => {
    const origin = request.get('Origin');
    const parsedOrigin = origin && URL.canParse(origin) ? new URL(origin) : null;
    const protocol = request.get('x-forwarded-proto')?.split(',')[0].trim() || request.protocol;
    const sameOrigin = parsedOrigin?.origin === `${protocol}://${request.get('host')}`;
    if (origin && !allowedOrigins.has(origin) && !sameOrigin) {
      sendError(response, 403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.');
      return;
    }
    if (origin) {
      response.set('Access-Control-Allow-Origin', origin);
      response.vary('Origin');
    }
    response.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Stripe-Signature');
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.post(`${API_PREFIX}/billing/webhook`, express.raw({ type: 'application/json', limit: '1mb' }), async (request, response) => {
    try {
      const signature = request.get('stripe-signature');
      if (!signature) throw new RequestError(400, 'INVALID_SIGNATURE', 'Stripe signature is required.');
      const stripe = stripeClient();
      const event = stripe.webhooks.constructEvent(request.body, signature, requiredEnv('STRIPE_WEBHOOK_SECRET'));
      let subscription;
      let userId;
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        userId = session.metadata?.user_id;
        if (session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        }
      } else if (event.type.startsWith('customer.subscription.')) {
        const eventSubscription = event.data.object;
        subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
        userId = subscription.metadata?.user_id;
      } else {
        response.json({ received: true });
        return;
      }

      if (!userId || !subscription) {
        logger.error('Stripe event is missing its Gymify user or subscription:', event.id);
        sendError(response, 400, 'INVALID_EVENT', 'The subscription event is missing required metadata.');
        return;
      }
      const { error } = await adminSupabase().rpc('sync_stripe_subscription', {
        p_event_id: event.id,
        p_user_id: userId,
        p_customer_id: typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
        p_subscription_id: subscription.id,
        p_subscription_created: subscription.created,
        p_status: subscription.status,
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_event_created: event.created,
      });
      if (error) throw error;
      response.json({ received: true });
    } catch (error) {
      if (error instanceof RequestError) {
        sendError(response, error.status, error.code, error.message);
        return;
      }
      logger.error('Stripe webhook failed:', error);
      sendError(response, 400, 'WEBHOOK_FAILED', 'Stripe webhook could not be processed.');
    }
  });

  app.use(express.json({ limit: '32kb' }));

  async function authenticate(request, response, next) {
    try {
      const token = bearerToken(request);
      if (!token) throw new RequestError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
      const client = userSupabase(token);
      const { data: authData, error: authError } = await client.auth.getUser(token);
      if (authError || !authData.user) throw new RequestError(401, 'AUTH_REQUIRED', 'Your session expired. Please sign in again.');
      const { data: profile, error: profileError } = await client
        .from('profiles').select('id,display_name,role').eq('id', authData.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new RequestError(403, 'PROFILE_NOT_READY', 'Your profile is still being set up. Please try again shortly.');
      request.authUser = authData.user;
      request.profile = profile;
      request.db = client;
      next();
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not authenticate request');
    }
  }

  app.get(`${API_PREFIX}/health`, (_request, response) => {
    response.json({ data: { status: 'ok' } });
  });

  app.get(`${API_PREFIX}/gyms`, async (request, response) => {
    try {
      const filters = parseGymFilters(new URL(request.originalUrl, 'http://localhost').searchParams);
      const { data, error } = await publicSupabase()
        .from('gyms')
        .select(GYM_SELECT)
        .eq('published', true)
        .order('sort_order')
        .limit(500);
      if (error) throw error;
      const gyms = (data || []).map(serializeGym).filter((gym) => matchesGym(gym, filters));
      response.json({ data: sortGyms(gyms, filters.sort) });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not list gyms');
    }
  });

  app.get(`${API_PREFIX}/gyms/options`, async (_request, response) => {
    try {
      const client = publicSupabase();
      const [equipmentResult, amenitiesResult] = await Promise.all([
        client.from('equipment').select('name').order('name'),
        client.from('amenities').select('name').order('name'),
      ]);
      if (equipmentResult.error) throw equipmentResult.error;
      if (amenitiesResult.error) throw amenitiesResult.error;
      response.json({
        data: {
          equipment: equipmentResult.data.map((item) => item.name),
          amenities: amenitiesResult.data.map((item) => item.name),
        },
      });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load filter options');
    }
  });

  app.get(`${API_PREFIX}/gyms/:id`, async (request, response) => {
    try {
      const { data, error } = await publicSupabase()
        .from('gyms').select(GYM_SELECT).eq('id', request.params.id).eq('published', true).maybeSingle();
      if (error) throw error;
      if (!data) {
        sendError(response, 404, 'GYM_NOT_FOUND', 'No gym was found with that ID.');
        return;
      }
      response.json({ data: serializeGym(data) });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load gym');
    }
  });

  app.get(`${API_PREFIX}/trainers`, async (request, response) => {
    try {
      const search = (request.query.q || '').toString().trim().toLocaleLowerCase();
      if (search.length > 100) throw new RequestError(400, 'INVALID_QUERY', 'Search text must be 100 characters or fewer.');
      const { data, error } = await publicSupabase()
        .from('trainer_profiles')
        .select('user_id,display_name,bio,specialties,service_areas,avatar_url,trainer_gym_affiliations(gym_id,gyms(name,area))')
        .eq('verification_status', 'approved')
        .eq('is_active', true)
        .order('display_name')
        .limit(200);
      if (error) throw error;
      const trainers = (data || []).filter((trainer) => !search
        || [trainer.display_name, trainer.bio, ...trainer.specialties, ...trainer.service_areas]
          .some((value) => value.toLocaleLowerCase().includes(search)))
        .map((trainer) => ({
          id: trainer.user_id,
          name: trainer.display_name,
          bio: trainer.bio,
          specialties: trainer.specialties,
          serviceAreas: trainer.service_areas,
          avatarUrl: trainer.avatar_url,
          gyms: (trainer.trainer_gym_affiliations || [])
            .map((affiliation) => affiliation.gyms).filter(Boolean),
        }));
      response.json({ data: trainers });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not list trainers');
    }
  });

  app.get(`${API_PREFIX}/trainers/:id`, async (request, response) => {
    try {
      const { data, error } = await publicSupabase()
        .from('trainer_profiles')
        .select('user_id,display_name,bio,specialties,service_areas,avatar_url,trainer_gym_affiliations(gym_id,gyms(name,area))')
        .eq('user_id', request.params.id)
        .eq('verification_status', 'approved')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        sendError(response, 404, 'TRAINER_NOT_FOUND', 'This trainer is unavailable.');
        return;
      }
      response.json({ data: {
        id: data.user_id,
        name: data.display_name,
        bio: data.bio,
        specialties: data.specialties,
        serviceAreas: data.service_areas,
        avatarUrl: data.avatar_url,
        gyms: (data.trainer_gym_affiliations || []).map((item) => item.gyms).filter(Boolean),
      } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load trainer');
    }
  });

  app.post(`${API_PREFIX}/partnership-inquiries`, async (request, response) => {
    try {
      const body = request.body || {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validateString(body.email, 'Email', 254))) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide a valid email address.');
      }
      if (body.website) {
        response.status(201).json({ data: {} });
        return;
      }
      if (body.consent !== true) throw new RequestError(400, 'CONSENT_REQUIRED', 'Consent is required to submit this inquiry.');
      const { error } = await publicSupabase().rpc('submit_gym_partner_inquiry', {
        p_gym_name: validateString(body.gymName, 'Gym name', 120),
        p_contact_name: validateString(body.contactName, 'Contact name', 80),
        p_email: body.email.trim().toLocaleLowerCase(),
        p_phone: validateString(body.phone, 'Phone', 30, { optional: true }),
        p_location: validateString(body.location, 'Location', 250),
        p_message: validateString(body.message, 'Message', 2000, { optional: true }),
        p_consent: body.consent === true,
      });
      if (error) throw mapDatabaseError(error);
      response.status(201).json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not submit partnership inquiry');
    }
  });

  app.use(`${API_PREFIX}/me`, authenticate);
  app.use(`${API_PREFIX}/billing`, authenticate);
  app.use(`${API_PREFIX}/admin`, authenticate);

  app.get(`${API_PREFIX}/admin/partnership-inquiries`, async (request, response) => {
    try {
      if (request.profile.role !== 'admin') throw new RequestError(403, 'ROLE_REQUIRED', 'Admin account required.');
      const { data, error } = await request.db.from('gym_partner_inquiries')
        .select('id,gym_name,contact_name,email,phone,location,message,status,reviewed_at,created_at')
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      response.json({ data });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load partnership inquiries');
    }
  });

  app.patch(`${API_PREFIX}/admin/partnership-inquiries/:id`, async (request, response) => {
    try {
      if (request.profile.role !== 'admin') throw new RequestError(403, 'ROLE_REQUIRED', 'Admin account required.');
      if (!validUuid(request.params.id)) throw new RequestError(400, 'INVALID_INQUIRY_ID', 'Inquiry ID is invalid.');
      const status = request.body?.status;
      if (!['pending', 'approved', 'declined'].includes(status)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Inquiry status must be pending, approved, or declined.');
      }
      const { data, error } = await request.db.from('gym_partner_inquiries')
        .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
        .eq('id', request.params.id)
        .select('id,status,reviewed_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new RequestError(404, 'INQUIRY_NOT_FOUND', 'No partnership inquiry was found.');
      response.json({ data });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update partnership inquiry');
    }
  });

  app.post(`${API_PREFIX}/admin/partners`, async (request, response) => {
    try {
      if (request.profile.role !== 'admin') throw new RequestError(403, 'ROLE_REQUIRED', 'Admin account required.');
      const body = request.body || {};
      const email = validateString(body.email, 'Email', 254).toLocaleLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide a valid email address.');
      }
      const displayName = validateString(body.displayName, 'Display name', 80);
      const gymId = validateString(body.gymId, 'Gym ID', 120);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymId)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Gym ID must be a lowercase slug.');
      }
      const { error } = await request.db.rpc('admin_invite_partner', {
        p_email: email,
        p_display_name: displayName,
        p_gym_id: gymId,
      });
      if (error) throw mapDatabaseError(error);
      response.status(201).json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not assign gym partner access');
    }
  });

  app.get(`${API_PREFIX}/me`, async (request, response) => {
    try {
      const { data: subscription, error } = await request.db
        .from('subscriptions').select('tier,status,current_period_end').eq('user_id', request.profile.id).maybeSingle();
      if (error) throw error;
      response.json({ data: {
        user: {
          id: request.profile.id,
          name: request.profile.display_name,
          email: request.authUser.email,
          role: request.profile.role,
        },
        subscription: subscription || { tier: 'free', status: 'free', current_period_end: null },
      } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load account');
    }
  });

  app.get(`${API_PREFIX}/me/saved-gyms`, async (request, response) => {
    try {
      const { data, error } = await request.db.from('saved_gyms').select('gym_id').order('created_at');
      if (error) throw error;
      response.json({ data: { gymIds: data.map((item) => item.gym_id) } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load saved gyms');
    }
  });

  app.put(`${API_PREFIX}/me/saved-gyms/:gymId`, async (request, response) => {
    try {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.params.gymId)) {
        throw new RequestError(400, 'INVALID_GYM_ID', 'Gym ID is invalid.');
      }
      const { error } = await request.db.from('saved_gyms')
        .upsert({ user_id: request.profile.id, gym_id: request.params.gymId }, { onConflict: 'user_id,gym_id', ignoreDuplicates: true });
      if (error?.code === '23503') throw new RequestError(404, 'GYM_NOT_FOUND', 'No gym was found with that ID.');
      if (error) throw error;
      response.json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not save gym');
    }
  });

  app.delete(`${API_PREFIX}/me/saved-gyms/:gymId`, async (request, response) => {
    try {
      const { error } = await request.db.from('saved_gyms')
        .delete().eq('user_id', request.profile.id).eq('gym_id', request.params.gymId);
      if (error) throw error;
      response.json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not remove saved gym');
    }
  });

  app.get(`${API_PREFIX}/me/trainer-profile`, async (request, response) => {
    try {
      if (request.profile.role !== 'trainer') throw new RequestError(403, 'ROLE_REQUIRED', 'Trainer account required.');
      const [profileResult, contactResult, availabilityResult] = await Promise.all([
        request.db.from('trainer_profiles')
          .select('user_id,display_name,bio,specialties,service_areas,avatar_url,verification_status,is_active')
          .eq('user_id', request.profile.id).maybeSingle(),
        request.db.from('trainer_private').select('contact_email,contact_phone,contact_preference')
          .eq('user_id', request.profile.id).maybeSingle(),
        request.db.from('trainer_availability').select('id,weekday,starts_at,ends_at,timezone')
          .eq('trainer_id', request.profile.id).order('weekday').order('starts_at'),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (contactResult.error) throw contactResult.error;
      if (availabilityResult.error) throw availabilityResult.error;
      response.json({ data: {
        ...profileResult.data,
        contact: contactResult.data,
        availability: availabilityResult.data,
      } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load trainer profile');
    }
  });

  app.put(`${API_PREFIX}/me/trainer-profile`, async (request, response) => {
    try {
      if (request.profile.role !== 'trainer') throw new RequestError(403, 'ROLE_REQUIRED', 'Trainer account required.');
      const body = request.body || {};
      const bio = validateString(body.bio, 'Bio', 2000, { optional: true });
      const specialties = body.specialties;
      const serviceAreas = body.serviceAreas;
      if (!Array.isArray(specialties) || specialties.length > 20 || specialties.some((item) => typeof item !== 'string' || item.trim().length > 60)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide up to 20 valid specialties.');
      }
      if (!Array.isArray(serviceAreas) || serviceAreas.length > 20 || serviceAreas.some((item) => typeof item !== 'string' || item.trim().length > 80)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide up to 20 valid service areas.');
      }
      const patch = {
        bio,
        specialties: [...new Set(specialties.map((item) => item.trim()).filter(Boolean))],
        service_areas: [...new Set(serviceAreas.map((item) => item.trim()).filter(Boolean))],
        avatar_url: body.avatarUrl ? validateHttpsUrl(body.avatarUrl, 'Avatar URL') : null,
      };
      const { data, error } = await request.db.from('trainer_profiles')
        .update(patch).eq('user_id', request.profile.id)
        .select('user_id,display_name,bio,specialties,service_areas,avatar_url,verification_status').single();
      if (error) throw error;
      response.json({ data });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update trainer profile');
    }
  });

  app.put(`${API_PREFIX}/me/trainer-contact`, async (request, response) => {
    try {
      if (request.profile.role !== 'trainer') throw new RequestError(403, 'ROLE_REQUIRED', 'Trainer account required.');
      const body = request.body || {};
      if (!['email', 'phone', 'either'].includes(body.contactPreference)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Choose a valid contact preference.');
      }
      const contactEmail = body.contactEmail ? validateString(body.contactEmail, 'Email', 254) : null;
      const contactPhone = body.contactPhone ? validateString(body.contactPhone, 'Phone', 30) : null;
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide a valid contact email address.');
      }
      if ((body.contactPreference === 'email' && !contactEmail)
        || (body.contactPreference === 'phone' && !contactPhone)
        || (body.contactPreference === 'either' && !contactEmail && !contactPhone)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide contact details matching your contact preference.');
      }
      const { error } = await request.db.from('trainer_private').upsert({
        user_id: request.profile.id,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_preference: body.contactPreference,
      });
      if (error) throw error;
      response.json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update trainer contact');
    }
  });

  app.put(`${API_PREFIX}/me/trainer-availability`, async (request, response) => {
    try {
      if (request.profile.role !== 'trainer') throw new RequestError(403, 'ROLE_REQUIRED', 'Trainer account required.');
      const slots = request.body?.slots;
      if (!Array.isArray(slots) || slots.length > 42) {
        throw new RequestError(400, 'INVALID_INPUT', 'Provide up to 42 availability slots.');
      }
      const uniqueSlots = new Set();
      for (const slot of slots) {
        if (!Number.isInteger(slot?.weekday) || slot.weekday < 0 || slot.weekday > 6
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.startsAt)
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.endsAt)
          || slot.endsAt <= slot.startsAt
          || (slot.timezone || 'Asia/Manila') !== 'Asia/Manila') {
          throw new RequestError(400, 'INVALID_AVAILABILITY', 'Use valid same-day weekly time slots in Asia/Manila.');
        }
        const key = `${slot.weekday}:${slot.startsAt}:${slot.endsAt}`;
        if (uniqueSlots.has(key)) throw new RequestError(400, 'INVALID_AVAILABILITY', 'Availability slots cannot be duplicated.');
        uniqueSlots.add(key);
      }
      const { error } = await request.db.rpc('replace_trainer_availability', { p_slots: slots });
      if (error) throw mapDatabaseError(error);
      response.json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update trainer availability');
    }
  });

  app.use(`${API_PREFIX}/trainers`, authenticate);

  app.get(`${API_PREFIX}/trainers/:id/private`, async (request, response) => {
    try {
      if (!validUuid(request.params.id)) throw new RequestError(400, 'INVALID_TRAINER_ID', 'Trainer ID is invalid.');
      const client = request.db;
      const isTrainer = request.authUser.id === request.params.id;
      if (!isTrainer) {
        const { data: connection, error } = await client.from('trainer_requests').select('id')
          .eq('trainer_id', request.params.id).eq('requester_id', request.authUser.id)
          .eq('kind', 'connection').eq('status', 'accepted').maybeSingle();
        if (error) throw error;
        if (!connection) throw new RequestError(403, 'CONNECTION_REQUIRED', 'The trainer must accept your connection request first.');
      }
      const [contactResult, availabilityResult] = await Promise.all([
        client.from('trainer_private').select('contact_email,contact_phone,contact_preference')
          .eq('user_id', request.params.id).maybeSingle(),
        client.from('trainer_availability').select('weekday,starts_at,ends_at,timezone')
          .eq('trainer_id', request.params.id).order('weekday').order('starts_at'),
      ]);
      if (contactResult.error) throw contactResult.error;
      if (availabilityResult.error) throw availabilityResult.error;
      response.json({ data: { contact: contactResult.data, availability: availabilityResult.data } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load private trainer details');
    }
  });

  app.post(`${API_PREFIX}/trainers/:id/requests`, async (request, response) => {
    try {
      if (!validUuid(request.params.id)) throw new RequestError(400, 'INVALID_TRAINER_ID', 'Trainer ID is invalid.');
      const client = request.db;
      const body = request.body || {};
      if (!['connection', 'session'].includes(body.kind)) throw new RequestError(400, 'INVALID_INPUT', 'Request type is invalid.');
      const message = validateString(body.message || '', 'Message', 1000, { optional: true });
      let requestedStart = null;
      let requestedEnd = null;
      if (body.kind === 'session') {
        const start = Date.parse(body.requestedStart);
        const end = Date.parse(body.requestedEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          throw new RequestError(400, 'INVALID_INPUT', 'Choose a valid session start and end time.');
        }
        requestedStart = new Date(start).toISOString();
        requestedEnd = new Date(end).toISOString();
      }
      const { data, error } = await client.rpc('submit_trainer_request', {
        p_trainer_id: request.params.id,
        p_kind: body.kind,
        p_message: message,
        p_requested_start: requestedStart,
        p_requested_end: requestedEnd,
      });
      if (error) throw mapDatabaseError(error);
      response.status(201).json({ data: { requestId: data } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not create trainer request');
    }
  });

  app.get(`${API_PREFIX}/me/trainer-requests`, async (request, response) => {
    try {
      const { data, error } = await request.db.from('trainer_requests')
        .select('id,requester_id,trainer_id,kind,status,message,requested_start,requested_end,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const trainerIds = [...new Set(data.map((item) => item.trainer_id))];
      const requesterIds = [...new Set(data.map((item) => item.requester_id))];
      const allIds = [...new Set([...trainerIds, ...requesterIds])];
      const { data: profiles, error: profilesError } = allIds.length
        ? await request.db.from('profiles').select('id,display_name').in('id', allIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const names = new Map((profiles || []).map((profile) => [profile.id, profile.display_name]));
      response.json({ data: data.map((item) => ({
        ...item,
        trainerName: names.get(item.trainer_id) || null,
        requesterName: names.get(item.requester_id) || null,
      })) });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load trainer requests');
    }
  });

  app.patch(`${API_PREFIX}/me/trainer-requests/:id`, async (request, response) => {
    try {
      if (!validUuid(request.params.id)) throw new RequestError(400, 'INVALID_REQUEST_ID', 'Request ID is invalid.');
      if (!['accepted', 'declined', 'cancelled'].includes(request.body?.status)) {
        throw new RequestError(400, 'INVALID_INPUT', 'Request status is invalid.');
      }
      const { error } = await request.db.rpc('set_trainer_request_status', {
        p_request_id: request.params.id,
        p_status: request.body.status,
      });
      if (error) throw mapDatabaseError(error);
      response.json({ data: {} });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update trainer request');
    }
  });

  app.get(`${API_PREFIX}/me/partner-gyms`, async (request, response) => {
    try {
      if (request.profile.role !== 'gym_partner') throw new RequestError(403, 'ROLE_REQUIRED', 'Approved gym partner account required.');
      const { data, error } = await request.db.from('gym_partners')
        .select('gym_id,gyms(*)').eq('user_id', request.profile.id).not('approved_at', 'is', null);
      if (error) throw error;
      response.json({ data: data.map((item) => item.gyms).filter(Boolean) });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not load partner gyms');
    }
  });

  app.patch(`${API_PREFIX}/me/partner-gyms/:id`, async (request, response) => {
    try {
      if (request.profile.role !== 'gym_partner') throw new RequestError(403, 'ROLE_REQUIRED', 'Approved gym partner account required.');
      const allowed = ['name', 'area', 'address', 'monthly', 'day', 'category', 'description', 'hours', 'image', 'contact_url'];
      const stringLimits = { name: 120, area: 120, address: 250, category: 80, description: 4000, hours: 250 };
      const patch = {};
      for (const [key, value] of Object.entries(request.body || {})) {
        if (!allowed.includes(key)) throw new RequestError(400, 'INVALID_INPUT', `Cannot update ${key}.`);
        if (key === 'monthly' || key === 'day') {
          if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) {
            throw new RequestError(400, 'INVALID_INPUT', `${key} must be a whole number from 0 to 1000000.`);
          }
          patch[key] = value;
        } else if (key === 'contact_url' && (value === null || value === '')) {
          patch[key] = null;
        } else {
          const label = key.replaceAll('_', ' ');
          patch[key] = key === 'image' || key === 'contact_url'
            ? validateHttpsUrl(value, label)
            : validateString(value, label, stringLimits[key]);
        }
      }
      if (!Object.keys(patch).length) throw new RequestError(400, 'INVALID_INPUT', 'Provide at least one gym field to update.');
      const { data, error } = await request.db.from('gyms').update(patch)
        .eq('id', request.params.id).select(GYM_SELECT).maybeSingle();
      if (error) throw error;
      if (!data) throw new RequestError(404, 'GYM_NOT_FOUND', 'No editable gym was found.');
      response.json({ data: serializeGym(data) });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not update partner gym');
    }
  });

  app.post(`${API_PREFIX}/billing/checkout`, async (request, response) => {
    try {
      if (request.profile.role !== 'gym_goer') throw new RequestError(403, 'ROLE_REQUIRED', 'A gym-goer account is required for Premium.');
      const [subscriptionResult, admin] = await Promise.all([
        request.db.from('subscriptions').select('tier,status,stripe_customer_id')
          .eq('user_id', request.profile.id).maybeSingle(),
        Promise.resolve(adminSupabase()),
      ]);
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (subscriptionResult.data?.tier === 'premium'
        && ['active', 'trialing'].includes(subscriptionResult.data.status)) {
        throw new RequestError(409, 'ALREADY_PREMIUM', 'Your account already has an active Premium subscription.');
      }
      const stripe = stripeClient();
      const price = await stripe.prices.retrieve(requiredEnv('STRIPE_PREMIUM_PRICE_ID'));
      if (!price.active || price.currency !== 'php' || price.unit_amount !== 17500
        || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
        throw new RequestError(503, 'PRICE_MISCONFIGURED', 'Premium pricing is not configured for ₱175 per month.');
      }
      let customerId = subscriptionResult.data?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: request.authUser.email,
          name: request.profile.display_name,
          metadata: { user_id: request.profile.id },
        }, { idempotencyKey: `gymify-customer-${request.profile.id}` });
        customerId = customer.id;
        const { error } = await admin.from('subscriptions')
          .update({ stripe_customer_id: customerId }).eq('user_id', request.profile.id);
        if (error) throw error;
      }
      const existingSubscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      if (existingSubscriptions.data.some((subscription) => !['canceled', 'incomplete_expired'].includes(subscription.status))) {
        throw new RequestError(409, 'ALREADY_PREMIUM', 'Your account already has an active Premium subscription.');
      }
      const baseUrl = requiredEnv('APP_BASE_URL').replace(/\/+$/, '');
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: requiredEnv('STRIPE_PREMIUM_PRICE_ID'), quantity: 1 }],
        success_url: `${baseUrl}/plans?checkout=success`,
        cancel_url: `${baseUrl}/plans?checkout=cancelled`,
        client_reference_id: request.profile.id,
        metadata: { user_id: request.profile.id },
        subscription_data: { metadata: { user_id: request.profile.id } },
        allow_promotion_codes: false,
      }, { idempotencyKey: `gymify-checkout-${request.profile.id}-${Math.floor(Date.now() / 60000)}` });
      response.json({ data: { url: session.url } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not start Premium checkout');
    }
  });

  app.post(`${API_PREFIX}/billing/portal`, async (request, response) => {
    try {
      const { data, error } = await request.db.from('subscriptions')
        .select('stripe_customer_id').eq('user_id', request.profile.id).maybeSingle();
      if (error) throw error;
      if (!data?.stripe_customer_id) throw new RequestError(404, 'NO_BILLING_ACCOUNT', 'No billing account was found.');
      const stripe = stripeClient();
      const baseUrl = requiredEnv('APP_BASE_URL').replace(/\/+$/, '');
      const session = await stripe.billingPortal.sessions.create({
        customer: data.stripe_customer_id,
        return_url: `${baseUrl}/plans`,
      });
      response.json({ data: { url: session.url } });
    } catch (error) {
      sendSupabaseError(error, response, logger, 'Could not open billing portal');
    }
  });

  app.use((request, response) => {
    if (request.method === 'GET') {
      sendError(response, 404, 'NOT_FOUND', 'The requested API route was not found.');
      return;
    }
    response.set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'The requested method is not supported for this route.');
  });

  app.use((error, _request, response, _next) => {
    sendSupabaseError(error, response, logger, 'Unhandled API error');
  });

  return app;
}
