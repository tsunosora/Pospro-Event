import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMe } from '@/lib/api';

export function useCurrentUser() {
    const { data } = useQuery({
        queryKey: ['current-user'],
        queryFn: getMe,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const isManager = useMemo(() => {
        if (!data?.role) return false;
        const n = data.role.name.toLowerCase();
        return (
            n === 'admin' ||
            n === 'owner' ||
            n === 'pemilik' ||
            n.includes('manajer') ||
            n.includes('manager') ||
            n.includes('supervisor') ||
            n.includes('kepala')
        );
    }, [data]);

    return { currentUser: data, isManager };
}
