import { FastifyRequest, FastifyReply } from 'fastify';
import { auth, db } from '../plugins/firebase';
import { env } from '../config/env';

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Token de autenticacao ausente ou invalido.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let uid = '';
    let role = 'member';

    if (env.nodeEnv !== 'production' && env.devAdminToken && idToken === env.devAdminToken) {
        uid = 'dev-admin-123';
        role = 'admin';
    } else if (env.nodeEnv !== 'production' && env.devMemberToken && idToken === env.devMemberToken) {
        uid = 'dev-member-123';
        role = 'member';
    } else {
        try {
            const decodedToken = await auth.verifyIdToken(idToken);
            uid = decodedToken.uid;
            const email = decodedToken.email;

            if (email && env.rootAdminEmail && email === env.rootAdminEmail) {
                role = 'admin';
            } else if (decodedToken.role) {
                role = decodedToken.role;
            } else {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    role = userDoc.data()?.role || 'member';
                }
            }

            if (role && !decodedToken.role) {
                await auth.setCustomUserClaims(uid, { role });
            }
        } catch (error: any) {
            console.error(`[AUTH] Erro na autenticacao: ${error.message}`);
            return reply.code(403).send({ error: 'Falha na autenticacao do token.' });
        }
    }

    (request as any).user = { uid, role };
}
