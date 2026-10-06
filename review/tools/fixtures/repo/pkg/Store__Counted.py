# ═══════════════════════════════════════════════════════════════════════════════
# fixture — Store__Counted
# A subclass whose put() calls the base; dynamic dispatch in the fixture.
# ═══════════════════════════════════════════════════════════════════════════════

from pkg.Store__Memory import Store__Memory


class Store__Counted(Store__Memory):

    def put(self, key, value):
        self.writes = getattr(self, 'writes', 0) + 1
        return super().put(key, value)

    def writes_so_far(self):
        return self.writes
