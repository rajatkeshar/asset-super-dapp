var SwaggerCall = require('../utils/SwaggerCall.js');
var hlCall=require('../utils/hlCall.js');
var headerCall=require('../utils/headerCall.js');
var addressUtils = require('../utils/address');
var utils = require('../utils/util');
var blockWait = require('../utils/blockwait');
var dappCall = require('../utils/dappCall')

app.route.post('/user/exists',async function(req,cb){
  if(req.query.email===undefined) return "invalid input";
    var params={
        email:req.query.email
   }

   var result=await app.model.Mapping.exists(params);
   if(!result){
        var response = await SwaggerCall.call('GET', '/api/v1/user/exist?email=' + params.email, params);  //staging api
        if(response && !response.isSuccess){
             return "-1";
        }
        else {
            return "00";
        }
    }
    return "0";
});
app.route.post('/user/login', async function (req, cb) {
    var params = {
        email: req.query.email,
        password: req.query.password,
        totp:req.query.totp
    };
    var response = await SwaggerCall.call('POST', '/api/v1/login', params);//staging api
    return response;
});
app.route.post('/user/signup', async function (req, cb) {
    var params = {
            countryCode: req.query.countryCode,
            countryId: req.query.countryId,
            email: req.query.email,
            lastName: req.query.lastName,
            name:req.query.name,
            password:req.query.password,
            type:req.query.type
    };
    var response = await SwaggerCall.call('POST', '/api/v1/signup', params);//staging api
    return response;
});


app.route.post('/user/hllogin',async function(req,cb){
var params={
    secret:req.query.secret  
};
var token=req.query.token;
var response= await hlCall.call('POST','/api/v1/hyperledger/login',params,token);
return response;
});

app.route.post('/user/dappid',async function(req,cb){

    var newuser = await app.model.Newuser.exists({
        email: req.query.email
    });
    if(newuser) return {
        role: "new user"
    }
    var total = await app.model.Mapping.count({
        email: req.query.email
    })

    if(!total){
        app.sdb.create('newuser', {
            email: req.query.email
        });
        return {
            role: "new user"
        };
    }

    var result = await app.model.Mapping.findAll({
        condition: {
            email:req.query.email
        },
        limit: req.query.limit,
        offset: req.query.offset
    });
    

    for(i in result){
        var company = await app.model.Company.findOne({
            condition: {
                dappid: result[i].dappid
            }
        });
        result[i] = Object.assign(result[i], company);
    }
    return result;
    
});
app.route.post('/user/wallet',async function(req,cb){
    var token=req.query.token
    var result=await headerCall.call('GET','/api/v1/wallets',token);
    return result;
});
app.route.post('/user/balance',async function(req,cb){
   var params={
    address:req.query.address
   }
 var token=req.query.belriumtoken;
   var response=await headerCall.call('GET','/api/v1/balance?address='+params.address,token);
   return response;
});
app.route.post('/user/kycstatus',async function(req,cb){
    var belriumtoken = req.query.belriumtoken;
    var response=await headerCall.call('GET','/api/v1/user/countries/kyc',belriumtoken);
    return response;
});
app.route.post('/user/kycmapping',async function(req,cb){
    var token = req.query.token;
    var params={
    kycDocumentMetaId:req.query.kycDocumentMetaId,
    kycDocumentTypeId:req.query.kycDocumentTypeId
    }
    var response=await headerCall.call('GET','/api/v1/kycdocs/kycdocformfieldmetas?kycDocumentMetaId='+params.kycDocumentMetaId+'&kycDocumentTypeId='+params.kycDocumentTypeId+'&countryCode=IN',token);
    return response;
});
app.route.post('/rolemapping',async function(req,cb){
    app.sdb.create('mapping', {
        dappid:req.query.dappid,
        email:req.query.email,
        role:req.query.role
    });
});
app.route.post('/mappingtable',async function(req,cb){
 var result = await app.model.Mapping.findAll({
});
return result;
});

//- Retreive username, companyname, from email
app.route.post('/user/companyname',async function(req,cb){
var email=req.query.email;
var res=await app.model.Mapping.findOne({ condition:{email:email},fields:['dappid']});
var response=await app.model.Company.findOne({condition:{dappid:res.dappid},fields:['company','country','name']
});
return response;
});

app.route.post("/dapp/updateDappBalance", async function(req){
    var response = await dappCall.call('PUT', `/api/dapps/transaction`, req.query);
    if(!response.success) return {
        isSuccess: false,
        message: response.error
    }

    var address = addressUtils.generateBase58CheckAddress(utils.getPublicKey(req.query.secret));
    console.log("The address generated is: " + address);

    app.sdb.create('recharge', {
        transactionId: response.transactionId,
        dappid: req.query.dappId,
        address: address,
        amount: req.query.amount,
        email: req.query.email,
        timestampp: new Date().getTime()
    });

    await blockWait();

    return {
        isSuccess: true,
        transactionId: response.transactionId
    }
})