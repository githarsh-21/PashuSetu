from src.repositories.schemes_repository import SchemesRepository

class SchemesService:
    def __init__(self):
        self.repo = SchemesRepository()

    def filter_schemes(self, category_filter: str = "All", search_query: str = "") -> str:
        all_schemes = self.repo.get_all_schemes()
        query = search_query.strip().lower()

        filtered = []
        for s in all_schemes:
            # Filter by category
            if category_filter != "All" and s["category"] != category_filter:
                continue
            # Search query filter
            if query:
                searchable = f"{s['name']} {s['category']} {s['benefits']} {s['eligibility']}".lower()
                if query not in searchable:
                    continue
            filtered.append(s)

        if not filtered:
            return "### 🔍 No schemes found matching your search criteria. Try clearing the filter."

        markdown_cards = []
        for s in filtered:
            card = f"""
---
### 🏛️ **{s['name']}**
- **Category:** `{s['category']}` | **Department:** *{s['department']}*
- **🎁 Key Benefits:** {s['benefits']}
- **🎯 Eligibility:** {s['eligibility']}
- **📝 How to Apply / Avail:** {s['how_to_apply']}
- **🌐 Portal:** [{s['official_portal']}]({s['official_portal']}) | 📞 **Helpline:** `{s['helpline']}`
"""
            markdown_cards.append(card)

        return "\n".join(markdown_cards)