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

import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { buildApiUrl, API_BASE_URL } from "./api-base";
import { buildAuthHeaders } from './auth-client';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth interceptor later
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = (config.method || "GET").toUpperCase();
    const currentHeaders =
        config.headers instanceof AxiosHeaders ? config.headers.toJSON() : config.headers ?? {};
    const normalizedHeaders = Object.fromEntries(
        Object.entries(currentHeaders).map(([key, value]) => [key, String(value)])
    );
    const nextHeaders = buildAuthHeaders(method, normalizedHeaders);
    config.headers = AxiosHeaders.from(nextHeaders);
    config.withCredentials = true;
    return config;
});

export { buildApiUrl };

export default api;
