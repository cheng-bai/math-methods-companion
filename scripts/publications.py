"""Explicit public inputs; private book chapters are never discovered by glob."""
import json
import re

FILES = ('demo.json', 'functions.json', 'sequences.json', 'trigonometry.json', 'vectors.json')


def load(content):
    return [json.loads((content / name).read_text()) for name in FILES]


def validate(publications, catalog, validate_chapter):
    ids = set()
    volumes = {chapter['volume'] for chapter in catalog}
    chapter_fields = {'id', 'title', 'volume', 'notice', 'overview', 'questions'}
    question_fields = {'id', 'title', 'type_family', 'type_title', 'type_note',
                       'role', 'difficulty', 'stem', 'answer', 'solution',
                       'equality', 'note', 'type_id'}
    for chapter in publications:
        if not chapter_fields <= set(chapter) or set(chapter) - chapter_fields - {'legacy_type_anchors'}:
            raise ValueError('公开讲字段不符合白名单')
        if not re.fullmatch(r'DEMO-[0-9]{2}', chapter['id']) or chapter['id'] in ids:
            raise ValueError('公开讲ID必须合法且唯一')
        ids.add(chapter['id'])
        if chapter['volume'] not in volumes or not chapter['questions']:
            raise ValueError('公开讲必须属于已有板块并包含完整题目')
        for field in chapter_fields - {'questions'}:
            if not isinstance(chapter[field], str) or not chapter[field].strip():
                raise ValueError('公开讲字段必须为非空文本')
            if any(ord(char) < 32 and char != '\n' for char in chapter[field]):
                raise ValueError('公开讲字段含有不允许的控制字符')
        for q in chapter['questions']:
            if set(q) != question_fields:
                raise ValueError('公开题字段不符合白名单')
            if any(not isinstance(value, str) or not value.strip() for value in q.values()):
                raise ValueError('公开题字段必须为非空文本')
            if any(ord(char) < 32 and char != '\n' for value in q.values() for char in value):
                raise ValueError('公开题字段含有不允许的控制字符')
        validate_chapter(chapter)
