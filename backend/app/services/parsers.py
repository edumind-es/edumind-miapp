#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

"""File parsers for different document types."""
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import re


def parse_text_file(file_path: Path) -> str:
    """Parse plain text or markdown files."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


# Límites de parseo (los ficheros ya están acotados en tamaño por MAX_UPLOAD_SIZE_MB)
MAX_PDF_PAGES = 300
MAX_IMAGE_PIXELS = 40_000_000


def parse_json_file(file_path: Path) -> List[Dict[str, Any]]:
    """Parse JSON file - expects array of objects or single object."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        return data
    return [data]


def parse_pdf(file_path: Path) -> str:
    """Extract text from PDF using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(file_path))
        text = ""
        # Tope de páginas: evita que un PDF enorme bloquee el worker.
        for index, page in enumerate(doc):
            if index >= MAX_PDF_PAGES:
                text += f"\n[Aviso: PDF truncado a {MAX_PDF_PAGES} páginas]\n"
                break
            text += page.get_text() + "\n"
        doc.close()
        return text.strip()
    except ImportError:
        return f"[Error: PyMuPDF not installed. Run: pip install PyMuPDF]"
    except Exception as e:
        return f"[Error parsing PDF: {str(e)}]"


def parse_docx(file_path: Path) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document
        doc = Document(str(file_path))
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        return "\n".join(text)
    except ImportError:
        return f"[Error: python-docx not installed. Run: pip install python-docx]"
    except Exception as e:
        return f"[Error parsing DOCX: {str(e)}]"


def parse_xlsx(file_path: Path) -> str:
    """Extract text from Excel using openpyxl."""
    try:
        from openpyxl import load_workbook
        wb = load_workbook(str(file_path), read_only=True)
        text_parts = []
        for sheet in wb.worksheets:
            text_parts.append(f"=== Sheet: {sheet.title} ===")
            for row in sheet.iter_rows(values_only=True):
                row_text = "\t".join(str(cell) if cell else "" for cell in row)
                if row_text.strip():
                    text_parts.append(row_text)
        wb.close()
        return "\n".join(text_parts)
    except ImportError:
        return f"[Error: openpyxl not installed. Run: pip install openpyxl]"
    except Exception as e:
        return f"[Error parsing XLSX: {str(e)}]"


def parse_pptx(file_path: Path) -> str:
    """Extract text from PowerPoint using python-pptx."""
    try:
        from pptx import Presentation
        prs = Presentation(str(file_path))
        text_parts = []
        for i, slide in enumerate(prs.slides, 1):
            text_parts.append(f"=== Slide {i} ===")
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    if shape.text.strip():
                        text_parts.append(shape.text)
        return "\n".join(text_parts)
    except ImportError:
        return f"[Error: python-pptx not installed. Run: pip install python-pptx]"
    except Exception as e:
        return f"[Error parsing PPTX: {str(e)}]"


def parse_image(file_path: Path) -> str:
    """Extract text from image using OCR (pytesseract)."""
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(str(file_path))
        if img.width * img.height > MAX_IMAGE_PIXELS:
            return f"[Error: imagen demasiado grande para OCR (máximo {MAX_IMAGE_PIXELS // 1_000_000} Mpx)]"
        text = pytesseract.image_to_string(img, lang='spa+eng')
        return text.strip()
    except ImportError:
        return f"[Error: pytesseract or PIL not installed. Run: pip install pytesseract Pillow]"
    except Exception as e:
        return f"[Error performing OCR: {str(e)}]"


def get_file_type(filename: str) -> str:
    """Determine file type from extension."""
    ext = Path(filename).suffix.lower()
    type_map = {
        '.pdf': 'pdf',
        '.docx': 'docx',
        '.doc': 'docx',
        '.xlsx': 'xlsx',
        '.xls': 'xlsx',
        '.pptx': 'pptx',
        '.ppt': 'pptx',
        '.md': 'markdown',
        '.txt': 'text',
        '.json': 'json',
        '.jsonl': 'jsonl',
        '.png': 'image',
        '.jpg': 'image',
        '.jpeg': 'image',
    }
    return type_map.get(ext, 'unknown')


def parse_file(file_path: Path) -> str:
    """Universal file parser."""
    file_type = get_file_type(file_path.name)
    
    if file_type == 'pdf':
        return parse_pdf(file_path)
    elif file_type == 'docx':
        return parse_docx(file_path)
    elif file_type == 'xlsx':
        return parse_xlsx(file_path)
    elif file_type == 'pptx':
        return parse_pptx(file_path)
    elif file_type in ('markdown', 'text'):
        return parse_text_file(file_path)
    elif file_type == 'image':
        return parse_image(file_path)
    elif file_type == 'json':
        data = parse_json_file(file_path)
        return json.dumps(data, ensure_ascii=False, indent=2)
    elif file_type == 'jsonl':
        return parse_text_file(file_path)
    else:
        return f"[Unsupported file type: {file_type}]"


def extract_training_pairs(text: str, source_type: str = "document") -> List[Dict[str, str]]:
    """
    Attempt to extract instruction/output pairs from text.
    This is a basic heuristic - in practice you'd want more sophisticated parsing.
    """
    pairs = []
    
    # Try to find Q&A patterns
    qa_patterns = [
        r'(?:Pregunta|P|Q):\s*(.+?)\n(?:Respuesta|R|A):\s*(.+?)(?=\n(?:Pregunta|P|Q):|$)',
        r'###\s*(.+?)\n(.+?)(?=###|$)',
    ]
    
    for pattern in qa_patterns:
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        for match in matches:
            if len(match) == 2:
                instruction = match[0].strip()
                output = match[1].strip()
                if instruction and output:
                    pairs.append({
                        "instruction": instruction,
                        "output": output,
                        "source": source_type
                    })
    
    # If no pairs found, treat the whole text as a single item
    if not pairs and text.strip():
        # Try to split into chunks for manual review
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        for i, para in enumerate(paragraphs[:10]):  # Limit to first 10
            pairs.append({
                "instruction": f"[Fragmento {i+1} - Requiere edición manual]",
                "output": para,
                "source": source_type
            })
    
    return pairs
