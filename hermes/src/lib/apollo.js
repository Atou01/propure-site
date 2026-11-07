const APOLLO_URL = "https://api.apollo.io/api/v1/mixed_companies/search";

/**
 * Recherche d'entreprises Apollo pour un segment.
 * Coût : 1 crédit Apollo par appel retournant au moins un résultat.
 */
export async function searchCompanies({ keywords, locations, employeeRanges, page = 1, perPage = 25 }) {
  const res = await fetch(APOLLO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.APOLLO_API_KEY,
    },
    body: JSON.stringify({
      q_organization_keyword_tags: keywords,
      organization_locations: locations,
      organization_num_employees_ranges: employeeRanges,
      page,
      per_page: perPage,
    }),
  });

  if (!res.ok) {
    throw new Error(`Apollo ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return (data.organizations || []).map((o) => ({
    apolloId: o.id,
    name: o.name,
    website: o.website_url || null,
    domain: o.primary_domain || null,
    linkedin: o.linkedin_url || null,
    phone: o.primary_phone?.number || o.phone || null,
    foundedYear: o.founded_year || null,
  }));
}
