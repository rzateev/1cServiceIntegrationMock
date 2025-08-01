import User from './models/User';

const initAdmin = async () => {
    // mongoose.connect уже вызывается в index.ts, здесь не нужен повторный connect
    const exists = await User.findOne({ username: 'admin' });
    if (!exists) {
        await User.create({ username: 'admin', password: 'admin', roles: ['admin'] });
        console.log('App admin user created');
    } else {
        console.log('App admin user already exists');
    }
};

export default initAdmin;