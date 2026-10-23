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

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
from fpdf import FPDF
import html

from app.core.security import get_client_ip

router = APIRouter()


def _export_limit_key(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(key_func=_export_limit_key)


class ExportRequest(BaseModel):
    content: str
    filename: str = "documento"
    title: Optional[str] = None


@router.post("/pdf")
@limiter.limit("12/minute")
async def export_pdf(request: Request, payload: ExportRequest):
    """Export content to PDF format."""
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Add title if provided
        if payload.title:
            pdf.set_font("Helvetica", "B", 16)
            pdf.multi_cell(0, 10, payload.title)
            pdf.ln(5)
        
        # Add content
        pdf.set_font("Helvetica", "", 11)
        
        # Clean and encode content for PDF
        clean_content = html.unescape(payload.content)
        # Handle Unicode by encoding to latin-1 with replacement
        try:
            pdf.multi_cell(0, 6, clean_content)
        except UnicodeEncodeError:
            # Fallback: replace non-latin characters
            safe_content = clean_content.encode('latin-1', errors='replace').decode('latin-1')
            pdf.multi_cell(0, 6, safe_content)
        
        # Output to bytes
        pdf_bytes = pdf.output()
        buffer = BytesIO(pdf_bytes)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={payload.filename}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


@router.post("/txt")
@limiter.limit("12/minute")
async def export_txt(request: Request, payload: ExportRequest):
    """Export content to plain text format."""
    try:
        content = payload.content
        if payload.title:
            content = f"{payload.title}\n{'=' * len(payload.title)}\n\n{content}"
        
        buffer = BytesIO(content.encode('utf-8'))
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={payload.filename}.txt"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating TXT: {str(e)}")


@router.post("/html")
@limiter.limit("12/minute")
async def export_html(request: Request, payload: ExportRequest):
    """Export content to HTML format (can be opened in Word)."""
    try:
        # Convert line breaks to HTML
        html_content = payload.content.replace('\n', '<br>\n')
        
        full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{payload.title or payload.filename}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        h1 {{
            color: #2563eb;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
        }}
    </style>
</head>
<body>
    {f'<h1>{payload.title}</h1>' if payload.title else ''}
    <div class="content">
        {html_content}
    </div>
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        Generado con EDUmind AI
    </footer>
</body>
</html>"""
        
        buffer = BytesIO(full_html.encode('utf-8'))
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={payload.filename}.html"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating HTML: {str(e)}")
