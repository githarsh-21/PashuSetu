class SchemesRepository:
    SCHEMES_DATA = [
        {
            "id": "nadcp_fmd",
            "name": "National Animal Disease Control Programme (NADCP / LHDCP)",
            "category": "Free Vaccination",
            "department": "Department of Animal Husbandry & Dairying (DAHD), Govt of India",
            "benefits": "100% Free vaccination against Foot & Mouth Disease (FMD) every 6 months and Brucellosis vaccination for all 4-8 month female calves.",
            "eligibility": "All cattle, buffalo, sheep, and goat rearers across all Indian states.",
            "how_to_apply": "Vaccination is provided free at doorstep/village camps by local government veterinary officers & Livestock Development Officers (LDO).",
            "official_portal": "https://dahd.gov.in/en/schemes/programmes/nadcp",
            "helpline": "Kisan Call Centre: 1800-180-1551"
        },
        {
            "id": "pashu_kcc",
            "name": "Pashu Kisan Credit Card (PKCC)",
            "category": "Loans & Credit",
            "department": "Ministry of Agriculture & Farmers Welfare / Commercial & Rural Banks",
            "benefits": "Working capital loan for cattle feed, medicines, and upkeep up to ₹1.60 Lakh without collateral (up to ₹3 Lakh with standard norms) at a subsidized interest rate (effective 4% on timely repayment).",
            "eligibility": "Small and marginal farmers owning cows, buffaloes, goats, or poultry.",
            "how_to_apply": "Apply through any local State Bank of India, Rural Regional Bank (RRB), or CSC center with Aadhaar, Land Record/Pashu verification, and bank passbook.",
            "official_portal": "https://www.myscheme.gov.in/schemes/pkcc",
            "helpline": "1800-11-2211 / 1800-425-3800"
        },
        {
            "id": "rashtriya_gokul",
            "name": "Rashtriya Gokul Mission (RGM)",
            "category": "Breeding & Subsidies",
            "department": "DAHD, Ministry of Fisheries, Animal Husbandry & Dairying",
            "benefits": "Doorstep Artificial Insemination (AI), up to 50% subsidy on Sex-Sorted Semen (ensuring female calf birth with 90% probability), and subsidies for breed multiplication farms.",
            "eligibility": "Farmers rearing indigenous cattle breeds (Gir, Sahiwal, Red Sindhi, Tharparkar, Murrah buffalo, etc.).",
            "how_to_apply": "Contact your nearest Gram Panchayat Veterinary Dispensary or Livestock Assistant.",
            "official_portal": "https://dahd.gov.in/en/scheme/rashtriy-gokul-mission-rgm",
            "helpline": "1800-180-1551"
        },
        {
            "id": "livestock_insurance",
            "name": "National Livestock Mission (NLM) - Livestock Insurance",
            "category": "Insurance",
            "department": "Central & State Animal Husbandry Departments",
            "benefits": "Up to 50% to 70% government subsidy on cattle insurance premium rates for indigenous and crossbred milch cows/buffaloes to protect against accidental death and epidemic disease loss.",
            "eligibility": "Farmers and dairy owners holding tagged cattle (up to 5 animals per family under subsidized quota).",
            "how_to_apply": "Submit an insurance request to the local Government Veterinary Hospital; a veterinary surgeon will issue a health & valuation certificate.",
            "official_portal": "https://nlm.udyamimitra.in/",
            "helpline": "1800-180-1551"
        },
        {
            "id": "bharat_pashudhan",
            "name": "Bharat Pashudhan Portal (Pashu Aadhaar)",
            "category": "Identification & Health",
            "department": "DAHD, Government of India",
            "benefits": "Unique 12-digit Ear Tag Number and digital health record card for each animal, ensuring trace-back during vaccinations, milk recording, and insurance claims.",
            "eligibility": "All bovines and small ruminants in India.",
            "how_to_apply": "Government veterinary vaccinators install the yellow RFID/Polyurethane ear tag during village visits free of charge.",
            "official_portal": "https://bharatpashudhan.gov.in/",
            "helpline": "1800-180-1551"
        }
    ]

    @classmethod
    def get_all_schemes(cls):
        return cls.SCHEMES_DATA