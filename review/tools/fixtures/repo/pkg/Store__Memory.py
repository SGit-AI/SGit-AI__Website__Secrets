# ═══════════════════════════════════════════════════════════════════════════════
# fixture — Store__Memory
# A store that keeps items in a dict. The fixture's base class.
# ═══════════════════════════════════════════════════════════════════════════════

class Store__Memory:

    def __init__(self):
        self.items = {}

    def put(self, key, value):
        self.items[key] = value
        return self.count()

    def get(self, key):
        return self.items.get(key)

    def count(self):
        return len(self.items)
