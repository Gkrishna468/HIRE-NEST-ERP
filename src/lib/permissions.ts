export const checkIsAdmin = (role?: string | null, orgId?: string | null) => {
  if (!role) return false;
  const normalizedRole = role.toLowerCase().trim();
  return (
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedRole === "ops_admin" ||
    normalizedRole === "hq_admin" ||
    orgId === "ORG-GLOBAL-HQ"
  );
};

export const checkIsClient = (role: string) => {
  return role === "client" || role === "client_admin" || role === "client_hm" || role === "client_finance" || role === "client_recruiter";
};

export const checkIsVendor = (role: string) => {
  return role === "vendor" || role === "vendor_admin" || role === "vendor_recruiter";
};

export const checkIsRecruiter = (role: string) => {
  return role === "recruiter" || role === "independent_recruiter" || role === "freelancer_recruiter";
};

export const checkIsIndependent = (role: string) => {
  return role === "independent" || role === "independent_vendor" || role === "independent_consultant";
};

export const checkIsCandidate = (role: string) => {
  return role === "candidate";
};

