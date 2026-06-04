from backend.database import create_db_and_tables, engine
from sqlmodel import Session, select
from backend.models import Question, WrongQuestion, Category, ExamRecord
from backend.schemas import ExamSubmit, ExamAnswerItem
from backend import crud
import os

if os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'exam.db')):
    os.remove(os.path.join(os.path.dirname(__file__), '..', 'exam.db'))

create_db_and_tables()

with Session(engine) as session:
    cat = Category(name='test')
    session.add(cat)
    session.commit()
    session.refresh(cat)
    q = Question(category_id=cat.id, type=1, content='Q1', options='[]', correct_answer='A')
    session.add(q)
    session.commit()
    session.refresh(q)
    wq = WrongQuestion(question_id=q.id, user_answer='B', wrong_count=1)
    session.add(wq)
    session.commit()
    session.refresh(wq)
    print('Before count', len(session.exec(select(WrongQuestion)).all()))
    exam = ExamSubmit(category_id=cat.id, is_wrong_mode=0, answers=[ExamAnswerItem(question_id=q.id, user_answer='A')])
    res = crud.submit_exam(session=session, exam_data=exam)
    print('Res', res)
    print('After count', len(session.exec(select(WrongQuestion)).all()))
    print('Records', len(session.exec(select(ExamRecord)).all()))
