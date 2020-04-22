module.exports = {
    name: 'admins',
    fields: [
      {
        name: 'adminid',
        type: 'String',
        length: 255,
        primary_key: true
      },
      {
        name: 'name',
        type: 'String',
        length: 255
      },
      {
        name: 'role',
        type: 'String',
        length: 255
      },
      {
        name: 'email',
        type: 'String',
        length: 255
      },
      {
        name: 'passwordHash',
        type: 'String',
        length: 255
      },
      {
        name: 'timestampp',
        type: 'Number',
        length: 255
      },
      {
        name: 'deleted',
        type: 'String',
        length: 255
      }
    ]
  }
