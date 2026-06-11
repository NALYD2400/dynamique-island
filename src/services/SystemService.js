const { ipcRenderer } = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : { ipcRenderer: null };

export const SystemService = {
    async getStats() {
        try {
            if (ipcRenderer) {
                // In standalone app, we can just return standard stats or mock them cleanly
                return {
                    cpu: Math.floor(Math.random() * 25) + 8,
                    ram: Math.floor(Math.random() * 15) + 42,
                    totalRamGB: '16'
                };
            }
            throw new Error('IPC not available');
        } catch (e) {
            const cpu = Math.floor(Math.random() * 20) + 10;
            const ram = Math.floor(Math.random() * 15) + 40;
            return { cpu, ram, totalRamGB: '16' };
        }
    }
};
