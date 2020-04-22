var dappCall = require('../utils/dappCall');
var links = require('../utils/constants').links;
var blockWait = require('../utils/blockwait');
var util = require("../utils/util");
var addressUtils = require('../utils/address');
var getCharge = require('./admin').getCharge;

app.route.post('/findDappsByAddress', async function(req, cb){
    var address = req.query.address;
    var result = await app.model.Issueaddr.findAll({
        condition: {
            address: address
        }
    });
    return result;
})

app.route.post('/mapAddress', async function(req, cb){
    var address = req.query.address;
    var dappid = req.query.dappid;
    var check = await app.model.Issueaddr.exists({
        address: address,
        dappid: dappid,
        deleted: '0'
    });
    if(check) return 0;
    app.sdb.create('issueaddr', {
        address: address,
        dappid: dappid,
        timestampp: new Date().getTime(),
        deleted: '0'
    });
    return 1;
})

app.route.post('/user/getDappsByAddress', async function(req, cb){
    var resultArray = [];
    var result = await app.model.Issueaddr.findAll({
        condition: {
            address: req.query.address
        },
        fields: ['dappid']
    });
    for(i in result){
        var company = await app.model.Company.findOne({
            condition: {
                dappid: result[i].dappid
            }
        });
        result[i].company = company.company;
        result[i].assetType = company.assetType;
    }
    return result;
});

app.route.post('/mapUser', async function(req, cb){
    var mapping = await app.model.Mapping.findOne({
        condition: {
            email: req.query.email,
            dappid: req.query.dappid,
            role: req.query.role
        }
    });
    if(mapping) return {
        isSuccess: false,
        message: "Email already registered in the dapp with the same role"
    }
    var timestampp = new Date().getTime();
    app.sdb.del('newuser', {
        email: req.query.email
    });
    app.sdb.create('mapping', {
        email: req.query.email,
        dappid: req.query.dappid,
        role: req.query.role,
        timestampp: timestampp
    });
    return {
        isSuccess: true
    }
})

function getRandomString() {
    var text = "";
    var caps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var smalls = "abcdefghijklmnopqrstuvwxyz";
    
    for (var i = 0; i < 4; i++){
        text += caps.charAt(Math.floor(Math.random() * caps.length));
        text += smalls.charAt(Math.floor(Math.random() * smalls.length));
    }
    return text;
}

module.exports.registerDapp = async function (req, res) {
    console.log("Entering dapp registration");
    app.logger.log("******** Entering dapp registration ********");
    
    var randomText = getRandomString();
    randomText += ".zip";
    
    var link = links.centralServer + "/sendzip/" + randomText;
    if(req.query.assetType) link = links.centralServer + "/sendzip2/" + randomText;
    var dapp_params = {
        secret: req.query.secret,
        category: 1,
        name:req.query.name,
        description: req.query.des,
        type: 0,
        link: link,
        icon: "http://o7dyh3w0x.bkt.clouddn.com/hello.png",
        delegates: [
        "db18d5799944030f76b6ce0879b1ca4b0c2c1cee51f53ce9b43f78259950c2fd",
    	"590e28d2964b0aa4d7c7b98faee4676d467606c6761f7f41f99c52bb4813b5e4",
    	"bfe511158d674c3a1e21111223a49770bee93611d998e88a5d2ea3145de2b68b",
    	"7bbf62931cf3c596591a580212631aff51d6bc0577c54769953caadb23f6ab00",
		"452df9213aedb3b9fed6db3e2ea9f49d3db226e2dac01828bc3dcd73b7a953b4"
        ],
        unlockDelegates: 3,
        countryCode: "IN"
    };
    console.log(JSON.stringify(dapp_params));
    var response = await dappCall.call('PUT', `/api/dapps`, dapp_params);
    
    if(!response.success) return response;
    
    var email=req.query.email;
    var company=req.query.company;
    var name=req.query.name;
    var country=req.query.country;
    var  dappid=response.transaction.id;
    var timestampp = new Date().getTime();

    app.sdb.create('mapping', {
        email: email,
        dappid: dappid,
        role: 'superuser',
        timestampp: timestampp
    })
    app.sdb.del('newuser', {
        email: email
    });
    app.sdb.create('company',{
        dappid:dappid,
        company:company,
        country:country,
        name:name,
        assetType: req.query.assetType || "payslip",
        dappOwner: response.transaction.senderId,
        timestampp: timestampp
    });
    response.isSuccess = true;
    return response;
}

async function setIssueLimit(req){
    if(!req.query.centralServerKey) return {
        isSuccess: false,
        message: "Need to provide the centralServerKey, issue limit not updated."
    }
    if(!util.centralServerCheck(req.query.centralServerKey)) return {
        isSuccess: false,
        message: "Central Server authentication failed, issue limit not updated."
    }         
    if(!req.query.email) return {
        isSuccess: false,
        message: "Need to provide the superuser's email"
    }
    if(!req.query.limit) return {
        isSuccess: false,
        message: "Need to provide a new limit."
    }
    try{
        req.query.limit = Number(req.query.limit);
    } catch(err){
        return {
            isSuccess: false,
            message: "Limit should be a number"
        }
    }
    var emailMapping = await app.model.Mapping.findOne({
        condition: {
            email: req.query.email,
            role: "superuser"
        }
    });
    if(!emailMapping) return {
        isSuccess: false,
        message: "Email is not a superuser"
    }
    var response = await dappCall.call('POST', `/api/dapps/` + emailMapping.dappid + `/centralserver/addIssuelimits`, req.query);
    if(!response) return {
        isSuccess: false,
        message: "Could not connect to the DApp, status not updated"
    }
    return response;
}

app.route.post("/centralserver/addIssuelimits", setIssueLimit);

module.exports.installDapp = async function (req, res) {
    console.log("Entering dapp install");
    app.logger.log("******* Entering dapp install ********");
    
    var dappid=req.query.id;
    var install_params={
        id:dappid,
        master:"ytfACAMegjrK"
    }
    return await dappCall.call('POST', `/api/dapps/install`, install_params);
}

module.exports.launchDapp = async function (req, res) {
    console.log("Entering dapp launch");
    app.logger.log("******* Entering dapp launch ********");
    
    var dappid=req.query.id;
    var install_params={
        id:dappid,
        master:"ytfACAMegjrK"
    }
    return await dappCall.call('POST', `/api/dapps/launch`, install_params);
}

app.route.post('/registerDApp', module.exports.registerDapp);
app.route.post('/installDApp', module.exports.installDapp);
app.route.post('/launchDApp', module.exports.launchDapp);

app.route.post('/makeDapp', async function(req, cb){

    function sleep(ms){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
    }

    if(!req.query.centralServerKey)
    console.log("Started Dapp Register");
    var dappRegisterResult = await module.exports.registerDapp(req, cb);
    console.log("Dapp register result: " + JSON.stringify(dappRegisterResult));

    if(!dappRegisterResult) return "No response from Dapp registration call";
    if(!dappRegisterResult.success) return dappRegisterResult;

    console.log("Dapp successfully registered");

    console.log("About to do Dapp install");
    var count = 0;
    var installreq = {
        query: {
            id: dappRegisterResult.transaction.id
        }
    }
    do{
        await sleep(2000);
        console.log("Install Attempt: " + ++count);
        console.log("Installing with: " + JSON.stringify(installreq));
        var dappInstallResult = await module.exports.installDapp(installreq, 0);
        console.log("Installation Result: " + JSON.stringify(dappInstallResult));
        if(!dappInstallResult) return {
            isSuccess: false,
            message: "Please try installing DApp again",
            dappid: installreq.query.id,
            failedAt: "install"
        }
        if(count > 15) return {
            isSuccess: false,
            message: "Failed at Installation with error: " + JSON.stringify(dappInstallResult),
            dappid: installreq.query.id,
            failedAt: "install"
        }
    }while(!dappInstallResult.success);

    console.log("About to launch dapp");
    count = 0;

    do{
        await sleep(2000);
        console.log("Launch Attempt: " + ++count);
        var dappLaunchResult = await module.exports.launchDapp(installreq, 0);
        if(!dappLaunchResult) return {
            isSuccess: false,
            message: "Please try launching DApp again",
            dappid: installreq.query.id,
            failedAt: "launch"
        }
        if(count > 15) return {
            isSuccess: false,
            message: "Failed at Launch with error: " + JSON.stringify(dappInstallResult),
            dappid: installreq.query.id,
            failedAt: "launch"
        }
    }while(!dappLaunchResult.success);
    console.log("Finished Dapp launch");
    return {
        isSuccess: true,
        message: "Successfully Installed",
        dappid: installreq.query.id
    }
});

app.route.post('/mockCompany', async function(req, cb){
    app.sdb.create('company', {
        dappid: req.query.dappid,
        company: req.query.company,
        country: req.query.country,
        name: req.query.name
    });
})

app.route.post('/removeUsers', async function(req, cb){
    console.log("Here in SuperDapp remove: " + JSON.stringify(req)); 
    app.sdb.del('mapping', {
        email: req.query.email
    });
    return {
        isSuccess: true
    }
})


 app.route.post('/getPayedPayslip', async function(req, cb){
     var company = await app.model.Company.findOne({
         condition: {
             dappid: req.query.dappid
         }
     });

     if(!company) return {
         message: "Invalid company",
         isSuccess: false
     }

     var link = links.centralServer + '/payslip/' + req.query.random + '/' + req.query.dappid + '/' + req.query.hash;
     var response = await dappCall.call('POST', '/api/dapps/' + req.query.dappid + '/getPayedPayslip', {hash: req.query.hash, link: link, dappid: req.query.dappid});

     if(!response) return {
         message: "No response from the dapp",
         isSuccess: false
     }

     if(response.isSuccess && !response.payment){
        var fees = await getVerificationFee(req);
        response.verificationFee = fees.verificationFee;
        response.serviceFee = fees.serviceFee;
        response.dappOwner = company.dappOwner;
     }

     response.assetType = company.assetType;

     return response;
     
 })

 app.route.post('/generatePayslipLink', async function(req, cb){
     var dappcheck = await app.model.Company.findOne({
         condition: {
             dappid: req.query.dappid
         }
     });
     if(!dappcheck) return {
         message: "Invalid dapp id",
         isSuccess: false
     }

     var link = links.centralServer + '/payslip/' + getRandomString() + '/' + req.query.dappid;
     var response = await dappCall.call('POST', '/api/dapps/' + req.query.dappid + '/generatePayslipLink', {
         pid: req.query.pid,
         link: link,
         days: req.query.days,
         email: req.query.email
    });

    if(!response) return {
        message: "No response from dapp",
        isSuccess: false
    }

    return response;
 });

 app.route.post('/setVerificationFee', async function(req){
     if(!(req.query.fee && req.query.dappid && req.query.secret)) return {
         isSuccess: false,
         message: "Arguments missing"
     }
     var ownerAddress = addressUtils.generateBase58CheckAddress(util.getPublicKey(req.query.secret));

     var authCheck = await app.model.Company.exists({
         dappid: req.query.dappid,
         dappOwner: ownerAddress
     });
     if(!authCheck) return {
         isSuccess: false,
         message: "Wrong DApp owner"
     }

     var verificationFee = await app.model.Verificationfee.findOne({
         condition: {
             dappid: req.query.dappid
         }
     });
     if(verificationFee){
         app.sdb.update('verificationfee', {
             fee: req.query.fee
         }, {
             dappid: req.query.dappid
         });
     } else{
         app.sdb.create('verificationfee', {
             dappid: req.query.dappid,
             fee: req.query.fee
         });
     }

     await blockWait();

     return {
         isSuccess: true
     }
 });

 app.route.post('/getVerificationFee', getVerificationFee);

 async function getVerificationFee(req){
    var dapp = await app.model.Company.findOne({
        condition: {
            dappid: req.query.dappid
        }
    });
    if(!dapp) return {
        isSuccess: false,
        message: "Invalid Dappid"
    }
     var verificationFee = await app.model.Verificationfee.findOne({
         condition: {
             dappid: req.query.dappid
         }
     });
     if(!verificationFee) verificationFee = {
         fee: "0"
     }

     var charge = await getCharge(dapp);
    
     return {
         isSuccess: true,
         verificationFee: verificationFee.fee,
         serviceFee: charge.serviceFee
     }
 }

 app.route.post("/getAllServiceFeesDefined", async function(req){
     var condition = {
         deleted: '0'
     }
     var dtms = await new Promise((resolve)=>{
        let sql = `select companys.name, companys.assetType, companys.country, dtms.* from dtms join companys on companys.dappid = dtms.dappid where dtms.deleted = '0';`;
        app.sideChainDatabase.all(sql, [], (err, row)=>{
            if(err) resolve({
                isSuccess: false,
                message: JSON.stringify(err),
                result: {}
            });
            resolve({
                isSuccess: true,
                result: row
            });
        });
    });
    if(!dtms.isSuccess) return dtms;
     var atms = await app.model.Atm.findAll({
         condition: condition
     });
     var ctms = await app.model.Ctm.findAll({
         condition: condition
     });
     return {
         isSuccess: true,
         dappsFees: dtms.result,
         assetTypeFees: atms,
         countryFees: ctms
     }
 });

 app.route.post('/getServiceFees', async function(req){
    var create = {
        deleted: '0'
    }

    var notFound = {
        isSuccess: false,
        message: "No service fee defined"
    }

    function setValues(obj){
        return {
            isSuccess: true,
            serviceFee: obj.serviceFee
        }
    }
    var find;
    if (req.query.dappid){
        create.dappid = req.query.dappid;

        find = await app.model.Dtm.findOne({
            condition: create
        });
    } else if(req.query.assetType){
        create.assetType=req.query.assetType;
        create.country = req.query.country || '-';

        find = await app.model.Atm.findOne({
            condition: create
        });
    } else if(req.query.country){
        create.country = req.query.country;
        
        find = await app.model.Ctm.findOne({
            condition: create
        });
    }  else return {
        isSuccess: false,
        message: "Need to specify dappid or assetType or country to get fee"
    }

    if(!find) return notFound;
    return setValues(find);
 })
