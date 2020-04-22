var mysqlite3 = require('sqlite3');
var path = require('path');

module.exports = async function () {
  console.log('enter dapp init')

  app.events.on('newBlock', (block) => {
    console.log('new block received', block.height)
  })

  app.sideChainDatabase = new mysqlite3.Database(path.join(__dirname, "blockchain.db"), (err) => {
    if (err) {
      throw err;
    }
    console.log('Connected to the blockchain database');
  });

}