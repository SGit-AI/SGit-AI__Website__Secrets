# ═══════════════════════════════════════════════════════════════════════════════
# fixture — Service__Notes
# The entry point: a service that holds a store and exposes add() and read().
# ═══════════════════════════════════════════════════════════════════════════════

from pkg.Store__Counted import Store__Counted


class Service__Notes:

    def __init__(self):
        self.store = Store__Counted()

    def add(self, title, body):
        return self.store.put(title, body)

    def read(self, title):
        return self.store.get(title)
