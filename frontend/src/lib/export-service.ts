/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Export service for downloading generated content

const API_BASE = '/api/v1/export';

export interface ExportOptions {
    content: string;
    filename?: string;
    title?: string;
}

function safeFilename(raw?: string): string {
    const base = (raw || "documento").trim() || "documento";
    return base
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "documento";
}

async function downloadBlob(response: Response, filename: string) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function downloadLocalBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export const exportService = {
    async toPdf(options: ExportOptions): Promise<void> {
        const response = await fetch(`${API_BASE}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: options.content,
                filename: safeFilename(options.filename),
                title: options.title
            })
        });

        if (!response.ok) {
            throw new Error('Error exporting to PDF');
        }

        await downloadBlob(response, `${safeFilename(options.filename)}.pdf`);
    },

    // Word lo genera el servidor (python-docx); es el formato que piden los centros.
    async toDocx(options: ExportOptions): Promise<void> {
        const response = await fetch(`${API_BASE}/docx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: options.content,
                filename: safeFilename(options.filename),
                title: options.title
            })
        });

        if (!response.ok) {
            throw new Error('No se pudo exportar a Word.');
        }

        await downloadBlob(response, `${safeFilename(options.filename)}.docx`);
    },

    async toTxt(options: ExportOptions): Promise<void> {
        const textBlob = new Blob([options.content], { type: "text/plain;charset=utf-8" });
        downloadLocalBlob(textBlob, `${safeFilename(options.filename)}.txt`);
    },

    async toHtml(options: ExportOptions): Promise<void> {
        const pageTitle = escapeHtml(options.title || "Documento EDUmind");
        const pageBody = escapeHtml(options.content || "").replace(/\n/g, "<br />");
        const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${pageTitle}</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 2rem; color: #1f2937; line-height: 1.5; }
    h1 { font-size: 1.35rem; margin-bottom: 1rem; }
    main { white-space: normal; font-size: 0.98rem; }
  </style>
</head>
<body>
  <h1>${pageTitle}</h1>
  <main>${pageBody}</main>
</body>
</html>`;
        const htmlBlob = new Blob([html], { type: "text/html;charset=utf-8" });
        downloadLocalBlob(htmlBlob, `${safeFilename(options.filename)}.html`);
    }
};
