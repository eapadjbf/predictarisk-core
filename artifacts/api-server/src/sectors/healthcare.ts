import type { SectorProfile } from "./types";

/**
 * Perfil Healthcare — RASCUNHO. reviewStatus="draft":
 * as referências a cláusulas têm de ser verificadas por jurídico/compliance
 * antes de qualquer uso comercial. Não é aconselhamento legal.
 * Os pesos de criticidade são julgamento de especialista, a calibrar com dados reais.
 */
export const healthcare: SectorProfile = {
  sector: "Healthcare",
  version: "0.1.0",
  reviewStatus: "draft",
  criticalityEmphasis: 1.5,

  frameworks: [
    {
      id: "NIS2",
      name: "NIS2 Directive (EU) 2022/2555",
      market: "EU",
      applicability: "Prestadores de cuidados de saúde na UE (entidades essenciais/importantes, conforme dimensão).",
      sourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    },
    {
      id: "GDPR",
      name: "GDPR (EU) 2016/679",
      market: "EU",
      applicability: "Dados de saúde são categoria especial (Art. 9).",
      sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    },
    {
      id: "MDR",
      name: "Medical Device Regulation (EU) 2017/745",
      market: "EU",
      applicability: "Sobretudo fabricantes; relevante ao hospital nos requisitos exigidos aos fornecedores.",
      sourceUrl: "https://eur-lex.europa.eu/eli/reg/2017/745/oj",
    },
    {
      id: "ISO27799",
      name: "ISO 27799 / IEC 80001-1",
      market: "GLOBAL",
      applicability: "Boas práticas de segurança da informação em saúde e gestão de risco de redes com dispositivos médicos.",
    },
    {
      id: "HIPAA",
      name: "HIPAA Security & Breach Notification Rules",
      market: "US",
      applicability: "Apenas se houver operação ou dados de doentes nos EUA.",
      sourceUrl: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164",
    },
  ],

  controls: [
    {
      id: "HC-BACKUP",
      title: "Cópias de segurança offline/imutáveis e testes de restauro",
      recommendation: "Manter cópias offline ou imutáveis dos sistemas clínicos, com teste de restauro periódico e tempo de recuperação medido.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(c)" },
        { framework: "GDPR", ref: "Art. 32(1)(c)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(a)(7)" },
      ],
    },
    {
      id: "HC-DOWNTIME",
      title: "Procedimentos clínicos de contingência (modo manual)",
      recommendation: "Definir e ensaiar procedimentos manuais para os serviços críticos (urgência, bloco, UCI) durante indisponibilidade de sistemas.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(c)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(a)(7)" },
      ],
    },
    {
      id: "HC-SEGMENT",
      title: "Segmentação da rede de dispositivos médicos",
      recommendation: "Isolar dispositivos médicos e sistemas clínicos da rede administrativa e da internet; permitir só fluxos necessários.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(a)" },
        { framework: "ISO27799", ref: "IEC 80001-1 (gestão de risco de rede)" },
        { framework: "GDPR", ref: "Art. 32(1)(b)" },
        { framework: "HIPAA", ref: "45 CFR 164.312(a)(1)" },
      ],
    },
    {
      id: "HC-INVENTORY",
      title: "Inventário completo de ativos, incluindo dispositivos médicos",
      recommendation: "Manter inventário atualizado (versão de firmware, localização, criticidade clínica, fim de suporte) como base do risco.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(i)" },
        { framework: "ISO27799", ref: "IEC 80001-1 (inventário e risco)" },
        { framework: "HIPAA", ref: "45 CFR 164.310(d)(1)" },
      ],
    },
    {
      id: "HC-PATCH",
      title: "Gestão de vulnerabilidades e correções, com medidas compensatórias para equipamento legado",
      recommendation: "Priorizar correções por criticidade clínica; para dispositivos sem correção possível, isolar e monitorizar.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(e)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(a)(5)(ii)(B)" },
      ],
    },
    {
      id: "HC-IAM",
      title: "Autenticação multifator e gestão de acessos privilegiados",
      recommendation: "MFA para acesso remoto, administração e sistemas com dados de doentes; revisão periódica de contas privilegiadas.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(j)" },
        { framework: "NIS2", ref: "Art. 21(2)(i)" },
        { framework: "GDPR", ref: "Art. 32(1)(b)" },
        { framework: "HIPAA", ref: "45 CFR 164.312(d)" },
      ],
    },
    {
      id: "HC-EHR-AUDIT",
      title: "Registo e auditoria de acessos ao processo clínico",
      recommendation: "Registar e rever acessos a processos de doentes; alertar para consultas atípicas (ex.: sem relação clínica).",
      mappings: [
        { framework: "GDPR", ref: "Art. 32" },
        { framework: "NIS2", ref: "Art. 21(2)(i)" },
        { framework: "HIPAA", ref: "45 CFR 164.312(b)" },
      ],
    },
    {
      id: "HC-ENCRYPT",
      title: "Cifra de dados de doentes em repouso e em trânsito",
      recommendation: "Cifrar bases de dados, portáteis, suportes amovíveis e comunicações que contenham dados de saúde.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(h)" },
        { framework: "GDPR", ref: "Art. 32(1)(a)" },
        { framework: "HIPAA", ref: "45 CFR 164.312(e)(1)" },
      ],
    },
    {
      id: "HC-IR",
      title: "Plano de resposta a incidentes com circuito de notificação (24h/72h)",
      recommendation: "Plano testado, com responsáveis e modelos para alerta precoce, notificação à autoridade e comunicação aos titulares dos dados.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(b)" },
        { framework: "NIS2", ref: "Art. 23" },
        { framework: "GDPR", ref: "Art. 33" },
        { framework: "GDPR", ref: "Art. 34" },
        { framework: "HIPAA", ref: "45 CFR 164.400-414" },
      ],
    },
    {
      id: "HC-MONITOR",
      title: "Monitorização e deteção contínuas, incluindo anomalias em dispositivos",
      recommendation: "Deteção 24x7 sobre rede clínica e administrativa, com alertas para comportamento anómalo de dispositivos médicos.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(b)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(a)(1)(ii)(D)" },
      ],
    },
    {
      id: "HC-PHISHING",
      title: "Proteção de email e formação anti-phishing",
      recommendation: "Filtragem de email, simulações de phishing e formação periódica de profissionais clínicos e administrativos.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(g)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(a)(5)" },
      ],
    },
    {
      id: "HC-VENDOR",
      title: "Requisitos de segurança a fornecedores e fabricantes de dispositivos",
      recommendation: "Exigir em contrato: suporte de segurança com prazo, lista de componentes de software (SBOM), notificação de vulnerabilidades e acesso remoto controlado.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(d)" },
        { framework: "MDR", ref: "Anexo I, 17.2 e 17.4 (obrigações do fabricante)" },
        { framework: "HIPAA", ref: "45 CFR 164.308(b)" },
      ],
    },
    {
      id: "HC-DDOS",
      title: "Resiliência a negação de serviço nos serviços ligados à internet",
      recommendation: "Proteção anti-DDoS e capacidade de degradação controlada para portais e serviços ligados a sistemas clínicos.",
      mappings: [
        { framework: "NIS2", ref: "Art. 21(2)(c)" },
        { framework: "GDPR", ref: "Art. 32(1)(b)" },
      ],
    },
  ],

  threats: [
    {
      id: "ransomware",
      label: "Ransomware / cifra de sistemas",
      keywords: ["ransomware", "ransom", "encrypt", "cifr", "extors", "lockbit", "resgate"],
      criticalityWeight: 1.0,
      controls: ["HC-BACKUP", "HC-DOWNTIME", "HC-SEGMENT", "HC-IAM", "HC-PHISHING", "HC-IR", "HC-MONITOR"],
      impactAreas: ["Indisponibilidade de sistemas clínicos", "Risco para a segurança do doente", "Fuga de dados", "Coimas e notificação"],
    },
    {
      id: "medical_device_compromise",
      label: "Comprometimento de dispositivo médico",
      keywords: ["medical device", "dispositivo medico", "equipamento medico", "infusion", "infus", "ventilat", "ventilador", "pacs", "dicom", "imaging device", "iomt"],
      criticalityWeight: 0.95,
      controls: ["HC-SEGMENT", "HC-INVENTORY", "HC-PATCH", "HC-VENDOR", "HC-MONITOR"],
      impactAreas: ["Segurança direta do doente", "Indisponibilidade de equipamento", "Integridade de dados clínicos"],
    },
    {
      id: "legacy_vuln_exploit",
      label: "Exploração de vulnerabilidade / sistema sem correções",
      keywords: ["vulnerab", "exploit", "unpatched", "sem correc", "legacy", "legado", "cve", "outdated", "desatualiz", "end of life", "fim de vida"],
      criticalityWeight: 0.8,
      controls: ["HC-PATCH", "HC-INVENTORY", "HC-SEGMENT", "HC-MONITOR", "HC-VENDOR"],
      impactAreas: ["Porta de entrada para ransomware", "Comprometimento de equipamento clínico"],
    },
    {
      id: "system_outage",
      label: "Indisponibilidade de sistema clínico (falha/avaria)",
      keywords: ["outage", "downtime", "indisponib", "falha de sistema", "system failure", "crash", "avaria", "offline"],
      criticalityWeight: 0.8,
      controls: ["HC-DOWNTIME", "HC-BACKUP", "HC-MONITOR"],
      impactAreas: ["Atraso em cuidados", "Continuidade assistencial"],
    },
    {
      id: "supply_chain",
      label: "Incidente em fornecedor ou terceiro",
      keywords: ["supplier", "fornecedor", "vendor", "third party", "terceiro", "supply chain", "cadeia de abastec", "remote access vendor", "acesso remoto"],
      criticalityWeight: 0.6,
      controls: ["HC-VENDOR", "HC-IAM", "HC-SEGMENT", "HC-IR"],
      impactAreas: ["Dependência crítica", "Acesso remoto não controlado"],
    },
    {
      id: "ddos",
      label: "Negação de serviço (DDoS)",
      keywords: ["ddos", "denial of service", "negacao de servico", "flood", "dos attack"],
      criticalityWeight: 0.5,
      controls: ["HC-DDOS", "HC-MONITOR", "HC-DOWNTIME"],
      impactAreas: ["Portais de doentes indisponíveis", "Integrações clínicas afetadas"],
    },
    {
      id: "phishing",
      label: "Phishing / engenharia social",
      keywords: ["phish", "spear", "social engineering", "engenharia social", "spoof", "fraudulent email", "email fraud", "bec"],
      criticalityWeight: 0.4,
      controls: ["HC-PHISHING", "HC-IAM", "HC-MONITOR", "HC-IR"],
      impactAreas: ["Credenciais comprometidas", "Entrada de ransomware"],
    },
    {
      id: "ehr_unauthorized_access",
      label: "Acesso indevido a dados de doentes",
      keywords: ["unauthorized access", "unauthorised access", "acesso indevido", "acesso nao autorizado", "snooping", "ehr", "patient record", "processo clinico", "privilege", "credential"],
      criticalityWeight: 0.3,
      controls: ["HC-EHR-AUDIT", "HC-IAM", "HC-ENCRYPT", "HC-IR"],
      impactAreas: ["Violação de privacidade", "Notificação à autoridade (GDPR Art. 33)", "Coimas"],
    },
    {
      id: "data_exfiltration",
      label: "Fuga / exfiltração de dados",
      keywords: ["exfiltrat", "data breach", "data leak", "fuga de dados", "violacao de dados", "leak", "data theft"],
      criticalityWeight: 0.3,
      controls: ["HC-ENCRYPT", "HC-EHR-AUDIT", "HC-MONITOR", "HC-IR"],
      impactAreas: ["Violação de privacidade", "Danos reputacionais", "Coimas"],
    },
    {
      id: "insider_misuse",
      label: "Uso indevido por colaborador",
      keywords: ["insider", "colaborador", "employee misuse", "uso indevido", "misuse", "usb", "removable"],
      criticalityWeight: 0.3,
      controls: ["HC-EHR-AUDIT", "HC-IAM", "HC-ENCRYPT"],
      impactAreas: ["Violação de privacidade", "Fuga de dados"],
    },
  ],

  notes: [
    "Pesos de criticidade: julgamento de especialista, a calibrar com o hospital piloto.",
    "Referências a cláusulas: validar com jurídico/compliance antes de uso comercial.",
    "Este perfil mede exposição inferida a partir de eventos, não conformidade implementada.",
  ],
};
