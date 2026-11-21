import { useState } from 'react';
import { inquiryApiEnabled, memberRequest } from '../../../services/memberApi';

export default function InquiryForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (!inquiryApiEnabled) {
      const previewMessage = 'Your form looks good. This is a preview; nothing was sent or stored.';
      setMessage(previewMessage);
      return;
    }
    setBusy(true);
    try {
      const result = await memberRequest('/partnership-inquiries', { method: 'POST', body: {
        gymName: values.gymName.trim(), contactName: values.contactName.trim(),
        email: values.email.trim(), phone: values.phone.trim(), location: values.location.trim(),
        message: values.message.trim(), consent: true, website: values.website.trim(),
      } });
      const delivery = result?.emailDelivery || {};
      const successMessage = delivery.owner && delivery.admin
        ? 'Inquiry received. We emailed you a confirmation and notified the GYMIFY review team.'
        : delivery.owner
          ? 'Inquiry received and confirmation emailed. The team will review it in the admin dashboard.'
          : delivery.admin
            ? 'Inquiry received and sent to the GYMIFY review team. Email confirmation is temporarily unavailable; the team will contact you with updates.'
            : 'Inquiry received and saved. Email updates are not configured yet; the team will review it and contact you using the details provided.';
      setMessage(successMessage);
      form.reset();
    } catch (e) {
      const errorMessage = e.message || 'Could not send your inquiry. Please try again.';
      setError(errorMessage);
    }
    finally { setBusy(false); }
  }
  return <section className="form-panel inquiry-form" id="partner-inquiry" aria-labelledby="inquiry-title">
    <span className="eyebrow">LET'S START A CONVERSATION</span><h2 id="inquiry-title">Introduce your gym.</h2>
    <p>Share a few details so the team can discuss listing your gym. Submitting an inquiry does not create a paid partnership.</p>
    {!inquiryApiEnabled && <p className="form-notice">Frontend preview: submission is not connected yet. You can fill out and check this form; nothing will be sent.</p>}
    <form className="stack-form" onSubmit={submit} aria-busy={busy}>
      <label className="inquiry-honeypot" aria-hidden="true">Leave this field empty<input name="website" tabIndex="-1" autoComplete="off" /></label>
      <div className="form-grid">
        <label>Gym name<input name="gymName" required maxLength={120} autoComplete="organization" /></label>
        <label>Contact person<input name="contactName" required maxLength={80} autoComplete="name" /></label>
        <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        <label>Phone number <span className="optional">(optional)</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" /></label>
      </div>
      <label>Gym location in Naga City<input name="location" required maxLength={250} placeholder="Street or barangay" /></label>
      <label>Message <span className="optional">(optional)</span><textarea name="message" rows={4} maxLength={2000} placeholder="Tell us a little about your gym or ask a question." /></label>
      <label className="consent-label"><input name="consent" type="checkbox" required /><span>I agree that GYMIFY may use these details to respond to my partnership inquiry.</span></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      {message && <p role="status" className="form-success">{message}</p>}
      <button type="submit" className="button" disabled={busy}>{busy ? 'Sending...' : inquiryApiEnabled ? 'Send inquiry' : 'Check form (preview)'}</button>
    </form>
  </section>;
}
