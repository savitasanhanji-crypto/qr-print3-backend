const bcrypt = require('bcrypt');
const hash = '';
const passwords = ['12345678','121212','password','1234','admin','123456'];
passwords.forEach(p => bcrypt.compare(p, hash).then(r => console.log(p, '->', r)));
