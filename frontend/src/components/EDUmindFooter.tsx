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

// Pie EDUmind-Lámina: filete superior de 2px, bloque de marca, enlaces legales en mono
// y franja de los cinco mundos a sangre. Fórmula de autoría única: EDUmind® · Luis Vilela Acuña.

import './EDUmindFooter.css';

interface NavigationLink {
    href: string;
    label?: string;
}

interface EDUmindFooterProps {
    appName: string;
    version: string;
    versionStage?: 'Alpha' | 'Beta' | 'Stable' | 'RC';
    author?: string;
    year?: number;
    previousPage?: NavigationLink;
    nextPage?: NavigationLink;
    homeHref?: string;
    feedbackUrl?: string;
    feedbackLabel?: string;
    className?: string;
    locale?: 'es' | 'en' | 'zh';
    hideNavigation?: boolean;
    showVersion?: boolean;
}

interface FooterTranslations {
    previous: string;
    next: string;
    copyright: string;
    feedback: string;
    home: string;
    license: string;
    source: string;
}

const translations: Record<string, FooterTranslations> = {
    es: {
        previous: 'Anterior',
        next: 'Siguiente',
        copyright: '© {year}',
        feedback: 'Reportar error',
        home: 'Inicio',
        license: 'Software libre',
        source: 'Código fuente',
    },
    en: {
        previous: 'Previous',
        next: 'Next',
        copyright: '© {year}',
        feedback: 'Report issue',
        home: 'Home',
        license: 'Free software',
        source: 'Source code',
    },
    zh: {
        previous: '上一页',
        next: '下一页',
        copyright: '© {year}',
        feedback: '报告问题',
        home: '首页',
        license: 'Free software',
        source: 'Source code',
    },
};

const LEGAL_LINKS = [
    { href: 'https://edumind.es/es/legal/privacidad', label: 'Privacidad' },
    { href: 'https://edumind.es/es/legal', label: 'Aviso legal' },
    { href: 'https://edumind.es/es/legal/cookies', label: 'Cookies' },
    { href: 'https://edumind.es/es/legal/ia', label: 'Política de IA' },
    { href: 'https://donar.edumind.es', label: 'Apoyar' },
];

export default function EDUmindFooter({
    appName,
    version,
    versionStage,
    author = 'Luis Vilela Acuña',
    year = new Date().getFullYear(),
    previousPage,
    nextPage,
    homeHref,
    feedbackUrl,
    feedbackLabel,
    className = '',
    locale = 'es',
    hideNavigation = false,
    showVersion = true,
}: EDUmindFooterProps) {
    const t = translations[locale] || translations.es;
    const versionBadge = versionStage ? `v${version} · ${versionStage}` : `v${version}`;

    return (
        <footer className={`edumind-footer ${className}`}>
            <div className="lam-wrap">
                {!hideNavigation && (previousPage || nextPage || homeHref) && (
                    <nav className="footer-nav" aria-label="Navegación entre páginas">
                        {previousPage && (
                            <a href={previousPage.href} className="footer-link">
                                ← {previousPage.label || t.previous}
                            </a>
                        )}
                        {homeHref && !nextPage && (
                            <a href={homeHref} className="footer-link">
                                {t.home}
                            </a>
                        )}
                        {nextPage && (
                            <a href={nextPage.href} className="footer-link">
                                {nextPage.label || t.next} →
                            </a>
                        )}
                    </nav>
                )}

                <div className="footer-grid">
                    <div>
                        <p className="footer-brand">
                            EDUmind<sup>®</sup> · {author}
                        </p>
                        <p className="footer-meta">
                            {appName}
                            {showVersion ? ` · ${versionBadge}` : ''}
                            {' · OEPM M4319166 · '}
                            {t.copyright.replace('{year}', year.toString())}
                        </p>
                        <p className="footer-meta">
                            {t.license}{' '}
                            <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">
                                AGPL-3.0-or-later
                            </a>
                            {' / '}
                            <a href="https://eupl.eu/1.2/es/" target="_blank" rel="noopener noreferrer">
                                EUPL-1.2
                            </a>
                            {' · '}
                            <a href="https://github.com/edumind-es" target="_blank" rel="noopener noreferrer">
                                {t.source}: github.com/edumind-es
                            </a>
                        </p>
                    </div>

                    <ul className="footer-legal">
                        {LEGAL_LINKS.map((link) => (
                            <li key={link.href}>
                                <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-link">
                                    {link.label}
                                </a>
                            </li>
                        ))}
                        {feedbackUrl && (
                            <li>
                                <a href={feedbackUrl} target="_blank" rel="noopener noreferrer" className="footer-link">
                                    {feedbackLabel || t.feedback}
                                </a>
                            </li>
                        )}
                        <li>
                            <a href="mailto:contacto@edumind.es" className="footer-link">
                                contacto@edumind.es
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="worlds-bar" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </footer>
    );
}
