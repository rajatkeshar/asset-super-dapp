var locker = require('../utils/locker');
var blockWait = require('../utils/blockwait');
var dappCall = require('../utils/dappCall');

app.route.post('/dapps/getTransactionFee', async function(req){
    var company = await app.model.Company.findOne({
        condition: {
            dappid: req.query.dappid
        }
    });
    if(!company) return {
        isSuccess: false,
        message: "Dapp does not exist"
    }

    var fee = await app.model.Dappsfee.findOne({
        condition: {
            dappid: req.query.dappid,
            contract: req.query.contract,
            deleted: '0'
        }
    });
    if(!fee) return {
        isSuccess: true,
        fee: "Not defined"
    }
    return {
        isSuccess: true,
        fee: fee.transactionFee
    }
});

app.route.post('/dapps/getTransactionFees', async function(req){
    var company = await app.model.Company.findOne({
        condition: {
            dappid: req.query.dappid
        },
        fields: ['dappOwner']
    });
    if(!company) return {
        isSuccess: false,
        message: "Dapp does not exist"
    }
    
    var email = await app.model.Mapping.findOne({
        condition: {
            dappid: req.query.dappid,
            role: "superuser"
        }
    });

    var total = await app.model.Dappsfee.count({
        dappid: req.query.dappid,
        deleted: '0'
    });

    var fee = await app.model.Dappsfee.findAll({
        condition: {
            dappid: req.query.dappid,
            deleted: '0'
        },
        limit: req.query.limit,
        offset: req.query.offset
    });

    return {
        isSuccess: true,
        fee: fee,
        dappOwner: company.dappOwner,
        email: email.email
    }
})

app.route.post('/dapps/setTransactionFee', async function(req){
    if(!(req.query.dappid && req.query.contract && req.query.contractName && req.query.transactionFee)) return {
        isSuccess: false,
        message: "Inputs missing"
    }
    await locker('/dapps/setTransactionFee@', req.query.dappid);
    var company = await app.model.Company.findOne({
        condition: {
            dappid: req.query.dappid
        }
    });
    if(!company) return {
        isSuccess: false,
        message: "Dapp does not exist"
    }

    var fee = await app.model.Dappsfee.findOne({
        condition: {
            dappid: req.query.dappid,
            contract: req.query.contract,
            deleted: '0'
        }
    });
    try{
        var registerContract = await dappCall.call('POST', '/api/dapps/' + req.query.dappid + '/admin/setContractFee', {
            contract: req.query.contract,
            fee: req.query.transactionFee
        });
    } catch(err){
        console.log("DApp is offline, setting fee in the database");
    }
    if(registerContract && registerContract.isSuccess && !registerContract.isSuccess) return registerContract;

    if(!fee) {
        app.sdb.create('dappsfee', {
            dappid: req.query.dappid,
            contract: req.query.contract,
            contractName: req.query.contractName,
            transactionFee: req.query.transactionFee,
            deleted: '0'
        });
        await blockWait();
        return {
            isSuccess: true,
            message: "Transaction Fee set successfully"
        }
    }
    app.sdb.update('dappsfee',{
        transactionFee: req.query.transactionFee
    }, {
        dappid: req.query.dappid,
        contract: req.query.contract
    });
    await blockWait();
    return {
        isSuccess: true,
        message: "Transaction fee updates successfully"
    }
});

app.route.post('/dapps/setTransactionFees', async function(req){
    await locker('/dapps/setTransactionFee@' + req.query.dappid);
    if(!(req.query.dappid && req.query.contractFees)) return {
        isSuccess: false,
        message: "Inputs missing"
    }
    await locker('/dapps/setTransactionFee@', req.query.dappid);

    var company = await app.model.Company.findOne({
        condition: {
            dappid: req.query.dappid
        }
    });
    if(!company) return {
        isSuccess: false,
        message: "Dapp does not exist"
    }

    var contractFees = req.query.contractFees;
    try{
        var registerContract = await dappCall.call('POST', '/api/dapps/' + req.query.dappid + '/admin/setContractFees', {
            fees: contractFees
        });
    } catch(err){
        console.log("DApp is offline, setting fee in the database");
    }
    for(i in contractFees){
        let fee = await app.model.Dappsfee.findOne({
            condition: {
                dappid: req.query.dappid,
                contract: contractFees[i].contract,
                deleted: '0'
            }
        });
        if(!fee) {
            app.sdb.create('dappsfee', {
                dappid: req.query.dappid,
                contract: contractFees[i].contract,
                contractName: contractFees[i].contractName,
                transactionFee: contractFees[i].transactionFee,
                deleted: '0'
            });
        }
        app.sdb.update('dappsfee',{
            transactionFee: contractFees[i].transactionFee
        }, {
            dappid: req.query.dappid,
            contract: contractFees[i].contract
        });
    }
    await blockWait();
    return {
        isSuccess: true
    }
});
