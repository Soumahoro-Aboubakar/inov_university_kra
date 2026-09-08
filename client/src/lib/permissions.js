export const ROLE_LABELS = {
  principal_admin: 'Secrétariat principal',
  level_admin: 'Responsable de niveau',
  local_doctor: 'Docteur référent',
  contract_doctor: 'Docteur vacataire',
  student: 'Étudiant·e',
};

export const ROLES = {
  management: ['principal_admin', 'level_admin'],
  consultation: ['student', 'local_doctor', 'contract_doctor'],
  community: ['student', 'local_doctor', 'contract_doctor'],
  review: ['principal_admin'],
  catalog: ['principal_admin'],
  communications: ['principal_admin', 'level_admin'],
  contractors: ['principal_admin', 'contract_doctor'],
};

export const hasRole = (role, capability) => ROLES[capability]?.includes(role);
