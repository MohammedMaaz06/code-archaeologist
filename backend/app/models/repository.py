import datetime
import uuid
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    default_branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    head_commit: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    head_commit_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    head_commit_author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    total_loc: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    files: Mapped[List["FileIndex"]] = relationship("FileIndex", back_populates="repository", cascade="all, delete-orphan")


class FileIndex(Base):
    __tablename__ = "file_indices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id"), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    extension: Mapped[str] = mapped_column(String(32), nullable=False)
    language: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="files")
