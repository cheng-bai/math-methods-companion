"""Publication identity, field boundary, and chapter-qualified associations."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from publications import load, validate
from build import validate_demo
from example_links import validate as validate_links

ROOT = Path(__file__).resolve().parents[1]


class Publications(unittest.TestCase):
    def setUp(self):
        self.chapters = load(ROOT / 'content')
        self.catalog = json.loads((ROOT / 'content/catalog.json').read_text())

    def test_reviewed_publication_counts(self):
        validate(self.chapters, self.catalog, validate_demo)
        self.assertEqual([(c['id'], len(c['questions'])) for c in self.chapters],
                         [('DEMO-01', 5), ('DEMO-02', 4), ('DEMO-06', 4),
                          ('DEMO-04', 4), ('DEMO-05', 4), ('DEMO-07', 4), ('DEMO-08', 4), ('DEMO-09', 4), ('DEMO-10', 4), ('DEMO-11', 2)])

    def test_reject_duplicate_invalid_or_private_fields(self):
        variants = []
        for key, value in [('id', '../private'), ('id', 'DEMO-01'), ('volume', 'unknown'), ('private_path', 'private')]:
            data = copy.deepcopy(self.chapters)
            data[1][key] = value
            variants.append(data)
        for key, value in [('source', 'private'), ('solution', ''), ('id', 'Q201')]:
            data = copy.deepcopy(self.chapters)
            data[2]['questions'][1][key] = value
            variants.append(data)
        data = copy.deepcopy(self.chapters)
        data[2]['questions'][1]['type_note'] = '不一致的方法提示'
        variants.append(data)
        data = copy.deepcopy(self.chapters)
        data[3]['questions'][3]['note'] = '公式意外转义为制表符\theta'
        variants.append(data)
        for data in variants:
            with self.subTest(data=data[1]['id']), self.assertRaises(ValueError):
                validate(data, self.catalog, validate_demo)

    def test_links_use_chapter_and_question_identity(self):
        knowledge = json.loads((ROOT / 'content/knowledge.json').read_text())
        row = {'card_id':knowledge['cards'][0]['id'], 'chapter_id':'DEMO-02', 'question_id':'Q01', 'focus':'测试对应动作'}
        with self.assertRaises(ValueError):
            validate_links([row], knowledge, self.chapters)
        # Question numbers can be reused in distinct chapters without cross-linking.
        data = copy.deepcopy(self.chapters)
        data[1]['questions'][0]['id'] = 'Q01'
        validate_links([row, row | {'chapter_id':'DEMO-01'}], knowledge, data)
        with self.assertRaises(ValueError):
            validate_links([row, row], knowledge, data)


if __name__ == '__main__':
    unittest.main()
