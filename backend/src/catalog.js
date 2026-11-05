import { sampleGyms } from './data/sample-gyms.js';

export function listGyms({ query, budget, equipment, amenities, sort, featured, ids }) {
  const searchTerm = query.toLocaleLowerCase();
  return sampleGyms
    .filter((gym) => !query || [gym.name, gym.area, gym.category]
      .some((value) => value.toLocaleLowerCase().includes(searchTerm)))
    .filter((gym) => budget === undefined || gym.monthly <= budget)
    .filter((gym) => featured === undefined || gym.featured === featured)
    .filter((gym) => !ids || ids.includes(gym.id))
    .filter((gym) => equipment.every((name) => gym.equipment.includes(name)))
    .filter((gym) => amenities.every((name) => gym.amenities.includes(name)))
    .sort((left, right) => {
      if (sort === 'low' && left.monthly !== right.monthly) return left.monthly - right.monthly;
      if (sort === 'high' && left.monthly !== right.monthly) return right.monthly - left.monthly;
      if (sort === 'featured' && left.featured !== right.featured) {
        return Number(right.featured) - Number(left.featured);
      }
      return left.sortOrder - right.sortOrder;
    })
    .map((gym) => ({
      id: gym.id,
      name: gym.name,
      area: gym.area,
      address: gym.address,
      monthly: gym.monthly,
      day: gym.day,
      category: gym.category,
      description: gym.description,
      equipment: [...gym.equipment],
      amenities: [...gym.amenities],
      hours: gym.hours,
      image: gym.image,
      featured: gym.featured,
      sample: gym.sample,
      contactUrl: gym.contactUrl,
    }));
}

export function getGymById(id) {
  return listGyms({
    query: '',
    equipment: [],
    amenities: [],
    sort: 'featured',
    ids: [id],
  })[0] ?? null;
}

export function getGymFilterOptions() {
  return {
    equipment: [...new Set(sampleGyms.flatMap((gym) => gym.equipment))].sort(),
    amenities: [...new Set(sampleGyms.flatMap((gym) => gym.amenities))].sort(),
  };
}
