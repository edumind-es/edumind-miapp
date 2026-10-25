/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useState } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { fetchTeacherProfile, type TeacherProfile } from "@/lib/profile-service";

// Perfil del docente con sesión iniciada; null para visitantes o si aún no ha cargado.
export function useTeacherProfile(): TeacherProfile | null {
    const { user } = useAuthSession();
    const [profile, setProfile] = useState<TeacherProfile | null>(null);

    useEffect(() => {
        if (!user) return;
        let active = true;
        fetchTeacherProfile()
            .then((data) => {
                if (active) setProfile(data);
            })
            .catch(() => {
                if (active) setProfile(null);
            });
        return () => {
            active = false;
        };
    }, [user]);

    // Sin sesión no hay perfil, aunque quede uno en memoria de una sesión anterior.
    return user ? profile : null;
}
