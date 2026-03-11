import axios from 'axios';

const TWENTY_CRM_API_URL = process.env.TWENTY_CRM_API_URL || '';
const TWENTY_CRM_API_KEY = process.env.TWENTY_CRM_API_KEY || '';

const crmClient = axios.create({
  baseURL: TWENTY_CRM_API_URL,
  headers: {
    Authorization: `Bearer ${TWENTY_CRM_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export async function createLeadInCrm(params: {
  name: string;
  email: string;
  phone?: string;
  source?: string;
}): Promise<{ id: string } | null> {
  const nameParts = params.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const response = await crmClient.post('/rest/people', {
    name: {
      firstName,
      lastName,
    },
    emails: {
      primaryEmail: params.email,
    },
    phones: params.phone
      ? { primaryPhoneNumber: params.phone }
      : undefined,
  });

  const created = response.data?.data?.createPerson || response.data?.data || response.data;
  return { id: created.id };
}

export async function updateLeadInCrm(
  crmId: string,
  data: Record<string, unknown>
): Promise<void> {
  await crmClient.patch(`/rest/people/${crmId}`, data);
}

export async function getLeadFromCrm(crmId: string): Promise<{
  id: string;
  name?: string;
  email?: string;
  stage?: string;
} | null> {
  try {
    const response = await crmClient.get(`/rest/people/${crmId}`);
    const person = response.data?.data || response.data;
    return {
      id: person.id,
      name: `${person.name?.firstName || ''} ${person.name?.lastName || ''}`.trim(),
      email: person.emails?.primaryEmail,
      stage: person.stage,
    };
  } catch {
    return null;
  }
}
