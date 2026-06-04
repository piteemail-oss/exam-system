from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CategoryCreate(BaseModel):
    name: str

class CategoryRead(BaseModel):
    id: int
    name: str
    create_time: datetime
    question_count: Optional[int] = 0
    correct_rate: Optional[float] = 0.0
    wrong_count: Optional[int] = 0

class OptionItem(BaseModel):
    alias: str
    text: str

class QuestionCreate(BaseModel):
    category_id: int
    type: int
    content: str
    options: List[OptionItem]
    correct_answer: str
    analysis: Optional[str] = None

class QuestionRead(BaseModel):
    id: int
    category_id: int
    type: int
    content: str
    options: List[OptionItem]
    correct_answer: str
    analysis: Optional[str] = None
    create_time: datetime

class ExamAnswerItem(BaseModel):
    question_id: int
    user_answer: str

class ExamSubmit(BaseModel):
    category_id: int
    is_wrong_mode: int
    answers: List[ExamAnswerItem]

class WrongQuestionRead(BaseModel):
    id: int
    question: QuestionRead
    user_answer: Optional[str]
    wrong_count: int
    update_time: datetime
