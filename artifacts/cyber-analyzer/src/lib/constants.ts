export const SECTORS = [
  "Healthcare",
  "Banking",
  "Education",
  "Telecommunications",
  "Energy",
  "Retail",
  "Government",
  "Manufacturing",
  "Transportation",
  "Insurance",
] as const;

export const JOB_TITLES = [
  "CISO",
  "CTO",
  "CEO",
  "CFO",
  "Security Analyst",
  "IT Manager",
  "Consultant",
  "Other",
] as const;

export const SUPPORT_EMAIL = "info@cyberguardsys.com";

export const FREE_TIER_LIMIT_MESSAGE = `Your organisation has reached the maximum of 2 users on the free plan. To add more users, please contact ${SUPPORT_EMAIL} to upgrade your plan.`;

export const JOB_TITLE_TO_ROLE: Record<string, string> = {
  "CISO": "ciso",
  "CTO": "executive",
  "CEO": "executive",
  "CFO": "executive",
  "Security Analyst": "analyst",
  "IT Manager": "user",
  "Consultant": "user",
  "Other": "user",
};
