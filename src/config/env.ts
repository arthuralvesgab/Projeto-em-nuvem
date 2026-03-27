type NodeEnv = 'development' | 'test' | 'production';

function readNodeEnv(value?: string): NodeEnv {
    if (value === 'production' || value === 'test') {
        return value;
    }

    return 'development';
}

function readPort(value?: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

function readCorsOrigins(value?: string): string[] | '*' {
    if (!value || value.trim() === '') {
        return '*';
    }

    const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
    return origins.length > 0 ? origins : '*';
}

export const env = {
    nodeEnv: 'development' as NodeEnv,
    port: 5000,
    host: '0.0.0.0',
    corsOrigin: '*' as string[] | '*',
    rootAdminEmail: '',
    firebaseServiceAccountJson: '',
    googleApplicationCredentials: '',
    devAdminToken: '',
    devMemberToken: ''
};

export function refreshEnv() {
    env.nodeEnv = readNodeEnv(process.env.NODE_ENV);
    env.port = readPort(process.env.PORT);
    env.host = process.env.HOST || '0.0.0.0';
    env.corsOrigin = readCorsOrigins(process.env.CORS_ORIGIN);
    env.rootAdminEmail = process.env.ROOT_ADMIN_EMAIL || '';
    env.firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
    env.googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
    env.devAdminToken = process.env.DEV_ADMIN || '';
    env.devMemberToken = process.env.DEV_MEMBER || '';
}

refreshEnv();
