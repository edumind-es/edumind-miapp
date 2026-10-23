/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * Classroom Service - API calls for Teacher Premium class management
 */

import api from './api';

// Types
export interface TeacherClass {
    id: number;
    user_id: number;
    name: string;
    course: string;
    group: string;
    subject: string;
    academic_year: string;
    student_count: number;
    color: string;
    is_active: boolean;
}

export interface ClassSchedule {
    id: number;
    class_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room?: string;
}

export interface StudentCode {
    id: number;
    class_id: number;
    code: string;
    number: number;
    notes?: string;
}

export interface PlannerEntry {
    id: number;
    user_id: number;
    class_id: number;
    entry_date: string;
    start_time: string;
    end_time: string;
    title: string;
    description?: string;
    resource_id?: number;
    status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
    color?: string;
}

export interface GeneratedPlannerSession {
    session_number: number;
    entry_date: string;
    day_label: string;
    start_time: string;
    end_time: string;
    title: string;
    phase_label: string;
    focus: string;
    criteria: string[];
    contents: string[];
    methodology: string;
    dua_diversity?: string;
    resources: string[];
    description: string;
}

export interface GeneratedResource {
    id: number;
    user_id: number;
    resource_type: 'rubric' | 'session' | 'planning' | 'worksheet' | 'situation' | 'other';
    title: string;
    content: string;
    generation_params?: string;
}

// Request types
export interface CreateClassRequest {
    course: string;
    group: string;
    subject: string;
    academic_year: string;
    student_count: number;
    color?: string;
}

export interface CreateScheduleRequest {
    day_of_week: number;
    start_time: string;
    end_time: string;
    room?: string;
}

export interface CreatePlannerEntryRequest {
    class_id: number;
    entry_date: string;
    start_time: string;
    end_time: string;
    title: string;
    description?: string;
    resource_id?: number;
    color?: string;
}

export interface GeneratePlannerSequenceRequest {
    class_id: number;
    start_date: string;
    session_count: number;
    sequence_title: string;
    area: string;
    stage?: string;
    criteria: string[];
    contents: string[];
    methodology_slider: number;
    methodology_notes?: string;
    additional_proposals?: string;
    dua_diversity?: string;
    web_resources: string[];
    edumind_resource_refs: string[];
    linked_resource_ids: number[];
    edumind_apps: string[];
    external_resource_refs: string[];
    persist?: boolean;
}

export interface PlannerSequenceResponse {
    persisted: boolean;
    schedule_based: boolean;
    class_name: string;
    planning_resource_id?: number;
    planning_resource_title?: string;
    warnings: string[];
    occupied_slots: string[];
    planning_summary: string;
    sessions: GeneratedPlannerSession[];
    created_entries: PlannerEntry[];
}

export interface SaveResourceRequest {
    resource_type: GeneratedResource['resource_type'];
    title: string;
    content: string;
    generation_params?: Record<string, unknown>;
    link_to_class_id?: number;
}

// API Service
export const classroomService = {
    // Classes
    getClasses: async (): Promise<TeacherClass[]> => {
        const res = await api.get('/classroom/classes');
        return res.data;
    },

    getClass: async (id: number): Promise<TeacherClass> => {
        const res = await api.get(`/classroom/classes/${id}`);
        return res.data;
    },

    createClass: async (data: CreateClassRequest): Promise<TeacherClass> => {
        const res = await api.post('/classroom/classes', data);
        return res.data;
    },

    updateClass: async (id: number, data: Partial<CreateClassRequest>): Promise<TeacherClass> => {
        const res = await api.put(`/classroom/classes/${id}`, data);
        return res.data;
    },

    deleteClass: async (id: number): Promise<void> => {
        await api.delete(`/classroom/classes/${id}`);
    },

    // Schedule
    getSchedule: async (classId: number): Promise<ClassSchedule[]> => {
        const res = await api.get(`/classroom/classes/${classId}/schedule`);
        return res.data;
    },

    addScheduleSlot: async (classId: number, data: CreateScheduleRequest): Promise<ClassSchedule> => {
        const res = await api.post(`/classroom/classes/${classId}/schedule`, data);
        return res.data;
    },

    deleteScheduleSlot: async (classId: number, scheduleId: number): Promise<void> => {
        await api.delete(`/classroom/classes/${classId}/schedule/${scheduleId}`);
    },

    // Students
    getStudents: async (classId: number): Promise<StudentCode[]> => {
        const res = await api.get(`/classroom/classes/${classId}/students`);
        return res.data;
    },

    getPrintableStudentList: async (classId: number) => {
        const res = await api.get(`/classroom/classes/${classId}/print-list`);
        return res.data;
    },
};

export const plannerService = {
    getWeekPlanner: async (startDate: string): Promise<PlannerEntry[]> => {
        const res = await api.get('/planner/week', { params: { start_date: startDate } });
        return res.data;
    },

    getDayPlanner: async (day: string): Promise<PlannerEntry[]> => {
        const res = await api.get('/planner/day', { params: { day } });
        return res.data;
    },

    createEntry: async (data: CreatePlannerEntryRequest): Promise<PlannerEntry> => {
        const res = await api.post('/planner/entries', data);
        return res.data;
    },

    updateEntry: async (id: number, data: Partial<CreatePlannerEntryRequest>): Promise<PlannerEntry> => {
        const res = await api.put(`/planner/entries/${id}`, data);
        return res.data;
    },

    updateStatus: async (id: number, status: PlannerEntry['status']): Promise<PlannerEntry> => {
        const res = await api.patch(`/planner/entries/${id}/status`, null, { params: { status } });
        return res.data;
    },

    deleteEntry: async (id: number): Promise<void> => {
        await api.delete(`/planner/entries/${id}`);
    },

    createFromSchedule: async (startDate: string, weeks: number = 1): Promise<PlannerEntry[]> => {
        const res = await api.post('/planner/entries/from-schedule', null, {
            params: { start_date: startDate, weeks }
        });
        return res.data;
    },

    generateSequence: async (data: GeneratePlannerSequenceRequest): Promise<PlannerSequenceResponse> => {
        const res = await api.post('/planner/entries/generate-sequence', data);
        return res.data;
    },
};

export const resourceService = {
    getResources: async (type?: GeneratedResource['resource_type']): Promise<GeneratedResource[]> => {
        const res = await api.get('/resources/', { params: type ? { resource_type: type } : {} });
        return res.data;
    },

    getResource: async (id: number): Promise<GeneratedResource> => {
        const res = await api.get(`/resources/${id}`);
        return res.data;
    },

    saveResource: async (data: SaveResourceRequest): Promise<GeneratedResource> => {
        const res = await api.post('/resources/', data);
        return res.data;
    },

    deleteResource: async (id: number): Promise<void> => {
        await api.delete(`/resources/${id}`);
    },

    linkToClass: async (resourceId: number, classId: number, assignedDate?: string): Promise<void> => {
        await api.post(`/resources/${resourceId}/link`, {
            class_id: classId,
            assigned_date: assignedDate
        });
    },

    unlinkFromClass: async (resourceId: number, classId: number): Promise<void> => {
        await api.delete(`/resources/${resourceId}/link/${classId}`);
    },

    getResourcesByClass: async (classId: number): Promise<GeneratedResource[]> => {
        const res = await api.get(`/resources/by-class/${classId}`);
        return res.data;
    },
};
