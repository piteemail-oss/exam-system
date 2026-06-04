from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlmodel import Session
import shutil
import os
from .database import create_db_and_tables, get_session
from . import crud
from .schemas import CategoryCreate, QuestionCreate, ExamSubmit
from typing import List, Optional

app = FastAPI(title="Exam System API", version="1.0")

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Category APIs
@app.post("/api/categories/", response_model=crud.CategoryRead)
def create_category(category: CategoryCreate, session: Session = Depends(get_session)):
    return crud.create_category(session=session, category=category)

@app.get("/api/categories/", response_model=List[crud.CategoryRead])
def read_categories(session: Session = Depends(get_session)):
    return crud.get_categories(session=session)

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    return crud.delete_category(session=session, category_id=category_id)

# Question APIs
@app.post("/api/questions/", response_model=crud.QuestionRead)
def create_question(question: QuestionCreate, session: Session = Depends(get_session)):
    return crud.create_question(session=session, question=question)

@app.get("/api/questions/{category_id}")
def read_questions(
    category_id: int,
    random: bool = False,
    limit: Optional[int] = None,
    session: Session = Depends(get_session)
):
    return crud.get_questions_by_category(session=session, category_id=category_id, random=random, limit=limit)

# Wrong Question APIs
@app.get("/api/wrong-questions/")
def read_wrong_questions(
    category_id: Optional[int] = None,
    random: bool = False,
    limit: Optional[int] = None,
    session: Session = Depends(get_session)
):
    return crud.get_wrong_questions(session=session, category_id=category_id, random=random, limit=limit)

@app.post("/api/wrong-questions/question/{question_id}/cut/")
def cut_wrong_question_by_question(question_id: int, session: Session = Depends(get_session)):
    return crud.cut_wrong_question_by_question_id(session=session, question_id=question_id)

@app.post("/api/wrong-questions/{wrong_id}/cut/")
def cut_wrong_question(wrong_id: int, session: Session = Depends(get_session)):
    return crud.cut_wrong_question(session=session, wrong_question_id=wrong_id)

# Exam APIs
@app.post("/api/exam/submit/")
def submit_exam(exam_data: ExamSubmit, session: Session = Depends(get_session)):
    return crud.submit_exam(session=session, exam_data=exam_data)

@app.post("/api/questions/import/")
def import_questions(file: UploadFile = File(...), session: Session = Depends(get_session)):
    return crud.import_questions_from_file(session=session, file=file)

@app.post("/api/questions/import/preview/")
def preview_import_questions(file: UploadFile = File(...), session: Session = Depends(get_session)):
    return crud.preview_import_from_file(session=session, file=file)

# Backup and Restore APIs
@app.get("/api/backup/")
def backup_database():
    file_path = "exam.db"
    return FileResponse(file_path, filename="exam_backup.db")

@app.post("/api/restore/")
def restore_database(file: UploadFile = File(...)):
    file_path = "exam.db"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"success": True}
