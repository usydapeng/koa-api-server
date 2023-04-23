import dotenv from 'dotenv';
import _ from 'lodash';

dotenv.config();

const port = Number(process.env.PORT || '8080');
const bodyLimit = '100kb';
const corsHeaders = ['Link'];
const isDev = process.env.NODE_ENV === 'development';
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
const unprotectedRoutes = _.split(process.env.UNPROTECTED_ROUTES || '/api/user/test', ',');

export default { port, bodyLimit, corsHeaders, isDev, jwtSecret, unprotectedRoutes };
