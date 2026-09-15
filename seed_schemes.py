from src.repositories.user_repository import UserRepository

def seed_all_schemes():
    repo = UserRepository()
    print("Connecting to database...")

    schemes_data = [
        # --- 🇮🇳 ALL-INDIA CENTRAL SCHEMES ---
        # Format: Name, Agency, Description, Min Cows, Target Breed, Target Gender, Target Category, **Target State**, Benefit, Suggestion
        (
            "Pashu Kisan Credit Card (PKCC)",
            "Ministry of Fisheries, Animal Husbandry & Dairying",
            "Short-term collateral-free working capital loan up to ₹2 Lakh for livestock feed, medicine, and management.",
            1, "Any", "Any", "Any", "All",
            "Working capital loan at a subsidized interest rate of 4% per annum.",
            "You need to have at least 1 registered cow or buffalo to apply."
        ),
        (
            "National Livestock Mission (NLM)",
            "Ministry of Agriculture & Farmers Welfare",
            "Promotes entrepreneurship in breed improvement, fodder production units, and livestock insurance subsidies.",
            0, "Any", "Any", "Any", "All",
            "Up to 50% capital subsidy (up to ₹50 Lakh) for livestock farming and fodder units.",
            "Must register an enterprise/project or group proposal."
        ),
        (
            "Rashtriya Gokul Mission (RGM)",
            "Department of Animal Husbandry & Dairying (DAHD)",
            "Conservation and genetic development of indigenous and desi bovine breeds.",
            1, "Indigenous", "Any", "Any", "All",
            "Subsidized high-genetic merit semen doses, IVF support, and breed conservation incentives.",
            "Register or rear indigenous Indian breeds (e.g., Gir, Sahiwal, uvRed Sindhi, Tharparkar, Kankrej) to qualify."
        ),
        (
            "Animal Husbandry Infrastructure Development Fund (AHIDF)",
            "DAHD / NABARD",
            "Incentivizes private investment in dairy processing, value-added cattle products, and cattle feed plants.",
            0, "Any", "Any", "Any", "All",
            "3% interest subvention on bank loans and credit guarantee cover up to 25%.",
            "Open for FPOs, dairy cooperatives, and agri-entrepreneurs setting up processing infrastructure."
        ),
        (
            "Dairy Entrepreneurship Development Scheme (DEDS)",
            "NABARD",
            "Capital subsidy for setting up small dairy farms to generate self-employment.",
            2, "Any", "Any", "Any", "All",
            "25% capital subsidy (33.33% for SC/ST beneficiaries) on project cost.",
            "Expand your herd to at least 2 milch cows to unlock this NABARD subsidy."
        ),

        # --- 🚩 MAHARASHTRA STATE SCHEMES ---
        (
            "Navinyapurna Yojana (Maharashtra Innovative Dairy Scheme)",
            "Animal Husbandry Department, Maharashtra",
            "State-level scheme providing high subsidies for purchasing 2 or 6 milch cows/buffaloes to small/marginal farmers.",
            0, "Any", "Any", "Any", "Maharashtra",
            "50% subsidy for General category and up to 75% subsidy for SC/ST farmers on milch animal procurement.",
            "Requires residency in Maharashtra and small/marginal farmer registration."
        ),
        (
            "Sharad Pawar Gramin Samridhi Yojana (Cow Shed Construction)",
            "Rural Development Department, Maharashtra",
            "Assistance for constructing permanent, hygienic RCC pacca cow sheds and compost pits under MGNREGA.",
            2, "Any", "Any", "Any", "Maharashtra",
            "Direct grant up to ₹77,188 for constructing a hygienic cattle shelter for 2 to 6 animals.",
            "You need at least 2 cattle and an active MGNREGA Job Card in Maharashtra."
        ),

        # --- 🟢 ANDHRA PRADESH STATE SCHEMES ---
        (
            "YSR Cheyutha & Jagananna Pala Velluva",
            "Department of Animal Husbandry, Andhra Pradesh",
            "Financial empowerment scheme for rural women to procure milch cattle through dairy cooperative networks.",
            0, "Any", "Female", "Any", "Andhra Pradesh",
            "Financial aid of ₹18,750/year (₹75,000 over 4 years) plus tie-ups with Amul/AP Dairy cooperatives.",
            "Reserved exclusively for women farmers aged 45–60 years from eligible communities."
        ),
        (
            "YSR Pasu Nashta Parihara Padhakam (Livestock Loss Compensation)",
            "Government of Andhra Pradesh",
            "Social security and financial relief to livestock owners upon accidental or disease-related death of milch cattle.",
            1, "Any", "Any", "Any", "Andhra Pradesh",
            "Compensation of ₹30,000 per deceased indigenous/CB cow and ₹15,000 for buffaloes (up to 5 animals/year).",
            "Requires cattle to be ear-tagged and registered with local Rythu Bharosa Kendras (RBKs)."
        )
    ]

    print("Clearing out old schema data...")
    repo.clear_all_schemes()

    added = 0
    for s in schemes_data:
        try:
            # We are now passing 10 parameters to match the updated database schema!
            repo.add_scheme(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9])
            print(f"✅ Added: {s[0]}")
            added += 1
        except Exception as e:
            print(f"⚠️ Skipped/Error on {s[0]}: {e}")

    print(f"\n🎉 Total {added} schemes synced to the database!")

if __name__ == "__main__":
    seed_all_schemes()