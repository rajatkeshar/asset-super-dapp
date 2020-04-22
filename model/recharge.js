module.exports = {
    name: 'recharges',
    fields: [
      {
        name: 'transactionId',
        type: 'String',
        length: 255,
        primary_key: true
      },
      {
        name: 'dappid',
        type: 'String',
        length: 255
      },
      {
        name: 'address',
        type: 'String',
        length: 255
      },
      {
        name: 'amount',
        type: 'String',
        length: 255
      },
      {
        name: 'email',
        type: 'String',
        length: 255
      },
      {
        name: 'timestampp',
        type: 'Number',
        length: 255
      }
    ]
  }
