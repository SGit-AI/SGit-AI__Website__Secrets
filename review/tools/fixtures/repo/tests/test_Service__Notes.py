from pkg.Service__Notes import Service__Notes
from unittest import TestCase


class Test__Service__Notes(TestCase):

    def test_add_then_read(self):
        service = Service__Notes()
        service.add('a', 'b')
        self.assertEqual(service.read('a'), 'b')
