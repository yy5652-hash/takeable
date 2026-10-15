// Which NYU school offers a section (from its course code), and whether the student's
// home school gives credit for it.

const BY_SUFFIX = {
  UB: { key: "stern", name: "Stern" },
  UA: { key: "cas", name: "Arts & Science" },
  UE: { key: "steinhardt", name: "Steinhardt" },
  UT: { key: "tisch", name: "Tisch" },
  UG: { key: "gallatin", name: "Gallatin" },
  US: { key: "silver", name: "Silver" },
  UY: { key: "tandon", name: "Tandon" },
  UC: { key: "sps", name: "School of Professional Studies" },
  UF: { key: "liberal-studies", name: "Liberal Studies" },
  UH: { key: "abu-dhabi", name: "NYU Abu Dhabi" },
  SHU: { key: "shanghai", name: "NYU Shanghai" },
  UN: { key: "nursing", name: "Nursing" },
  UD: { key: "dentistry", name: "Dentistry" },
  UZ: { key: "non-school", name: "Non-School Based Programs" },
};

export function schoolOf(section) {
  // Wagner's undergraduate courses carry the UPADM subject with a -GP suffix.
  if (section.subject === "UPADM") return { key: "wagner", name: "Wagner" };
  const known = BY_SUFFIX[section.suffix];
  if (known) return known;
  if (/^G/.test(section.suffix)) return { key: "graduate", name: section.college || "a graduate school" };
  return { key: "unknown", name: section.college || section.suffix || "another school" };
}

// Stern undergraduate policy, "Minors and Electives":
// approved outside coursework is at CAS, Steinhardt, Tisch, Gallatin, Wagner, Silver and Tandon
// (Tandon: contact a Stern adviser first); no credit for School of Professional Studies courses.
export const STERN_RULES = {
  source: "https://www.stern.nyu.edu/current-students/undergraduate/academics/minors-and-electives",
  checked: "2026-10-15",
  approved: ["cas", "steinhardt", "tisch", "gallatin", "wagner", "silver", "tandon"],
  noCredit: ["sps"],
};

export const HOME_SCHOOLS = {
  stern: { label: "a Stern undergrad", rules: STERN_RULES },
  other: { label: "at another NYU school", rules: null },
};

export function creditReason(section, homeSchool) {
  const school = schoolOf(section);
  const rules = HOME_SCHOOLS[homeSchool]?.rules;
  const base = { kind: "credit", school };
  if (!rules) return { ...base, level: "check", text: `Offered by ${school.name} — credit rules for your school aren't loaded yet` };
  const source = { url: rules.source, checked: rules.checked };
  if (school.key === "stern") return { ...base, level: "pass", text: "Stern course", source };
  if (rules.noCredit.includes(school.key)) return { ...base, level: "fail", text: "No Stern credit for SPS courses", source };
  if (rules.approved.includes(school.key)) {
    const adviser = school.key === "tandon" ? " — talk to your adviser first" : "";
    return { ...base, level: "pass", text: `Approved school for Stern electives (${school.name})${adviser}`, source };
  }
  return { ...base, level: "check", text: `${school.name} isn't on Stern's approved list — ask your adviser`, source };
}
