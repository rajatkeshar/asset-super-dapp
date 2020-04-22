var dappCall = require('../utils/dappCall');
var util = require('../utils/util');
var blockWait = require('../utils/blockwait')


app.route.post('/getCompanies', async function(req, cb){
    var companies = await app.model.Company.findAll({});
    return {
        companies: companies,
        isSuccess: true
    }
});

app.route.post('/company/data', async function(req, cb){
    var company = await app.model.Company.findOne({
        condition: {
            company: req.query.company
        }
    });
    if(!company) return {
        message: "Company doesn't exists",
        isSuccess: false
    }

    var superAdmin = await app.model.Mapping.findOne({
        condition: {
            dappid: company.dappid,
            role: 'superuser'
        },
        fields: ['email']
    });
    var authorizerCount = await app.model.Mapping.count({
        dappid: company.dappid,
        role: 'authorizer'
    });
    var issuerCount = await app.model.Mapping.count({
        dappid: company.dappid,
        role: 'issuer'
    })

    var totalIssued = await dappCall.call('POST', '/api/dapps/' + company.dappid + '/totalCertsIssued', {}) 
    if(!totalIssued)
        totalIssued = "Dapp offline"

    return {
        superuser: superAdmin.email,
        authorizerCount: authorizerCount,
        issuerCount: issuerCount,
        totalIssued: totalIssued.totalCertificates,
        isSuccess: true
    }
});

app.route.post("/admin/assetStatistics", async function(req){
    var assetTypes = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (select distinct companys.assetType from companys);`;
        app.sideChainDatabase.get(sql, [], (err, row)=>{
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

    var allDapps = await app.model.Company.findAll({
        fields: ['dappid']
    })
    var sum = 0;
    for(i in allDapps){
        try{
        var totalIssued = await dappCall.call('POST', '/api/dapps/' + allDapps[i].dappid + '/totalCertsIssued', {});
        } catch (err){
            continue;
        }
        if(!totalIssued || !totalIssued.isSuccess) continue;
        sum += totalIssued.totalCertificates;
    }
    return {
        isSuccess: true,
        countOfAssetTypes: assetTypes.result.count,
        countOfDapps: allDapps.length,
        countOfTotalIssued: sum
    }
})

app.route.post("/admin/recentlyRegisteredDapps", async function(req){
    var dappsRegistered = await new Promise((resolve)=>{
        let sql = `select mappings.email as ownerEmail, companys.* from companys join mappings on mappings.dappid = companys.dappid and role = 'superuser' order by companys.timestampp desc limit ?;`;
        app.sideChainDatabase.all(sql, [req.query.limit || 5], (err, row)=>{
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

    dappsRegistered = dappsRegistered.result;

    for(i in dappsRegistered){
        try{
        var totalIssued = await dappCall.call('POST', '/api/dapps/' + dappsRegistered[i].dappid + '/totalCertsIssued', {});
        }catch(err){
            dappsRegistered[i].totalCertificatesIssued = "Dapp Offline";
            continue;
        }
        if(!totalIssued || !totalIssued.isSuccess){
            dappsRegistered[i].totalCertificatesIssued = "Dapp Offline";
            continue;
        } 
        dappsRegistered[i].totalCertificatesIssued = totalIssued.totalCertificates;
    }
    return {
        isSuccess: true,
        dappsRegistered: dappsRegistered
    }
})

app.route.post("/admin/assetSpecificDetails", async function(req){
    var assetTypes = await new Promise((resolve)=>{
        let sql = `select companys.assetType, count(*) as count from companys group by companys.assetType order by companys.assetType asc;`;
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

    assetTypes = assetTypes.result;

    for(i in assetTypes){
        var dapps = await app.model.Company.findAll({
            condition: {
                assetType: assetTypes[i].assetType
            },
            fields: ['dappid']
        });
        var sum = 0;
        for(j in dapps){
            try{
            var totalIssued = await dappCall.call('POST', '/api/dapps/' + dapps[j].dappid + '/totalCertsIssued', {});
            }catch(err){
                continue;
            }
            if(!totalIssued || !totalIssued.isSuccess) continue;
            sum += totalIssued.totalCertificates;
        }
        assetTypes[i].totalCertificatesIssued = sum;
    }
    return {
        isSuccess: true,
        assetTypes: assetTypes
    }
})

app.route.post("/admin/dappsRegistrationOnTimeLine", async function(req){
    var first = new Date();
    var last = new Date();
    first.setHours(0);
    first.setMinutes(0);
    first.setSeconds(0);
    last.setHours(23);
    last.setMinutes(59);
    last.setSeconds(59);
    let sql = `select count(*) as count from (select companys.dappid from companys where companys.timestampp between ? and ?);`;

    var todayCount = await new Promise((resolve)=>{
        app.sideChainDatabase.get(sql, [first.getTime() ,last.getTime()], (err, row)=>{
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
    var yesterdayCount = await new Promise((resolve)=>{
        let one = new Date(first.getTime());
        one.setDate(first.getDate()-1);
        var two = new Date(last.getTime());
        two.setDate(first.getDate()-1);
        app.sideChainDatabase.get(sql, [one.getTime() ,two.getTime()], (err, row)=>{
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
    var lastWeekCount = await new Promise((resolve)=>{
        let one = new Date(first.getTime());
        one.setDate(first.getDate()-7);
        app.sideChainDatabase.get(sql, [one.getTime() ,last.getTime()], (err, row)=>{ 
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
    var lastMonthCount = await new Promise((resolve)=>{
        let one = new Date(first.getTime());
        one.setMonth(first.getMonth()-1);
        app.sideChainDatabase.get(sql, [one.getTime() ,last.getTime()], (err, row)=>{ 
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

    return {
        isSuccess: true,
        todayCount: todayCount.result.count,
        yesterdayCount: yesterdayCount.result.count,
        lastWeekCount: lastWeekCount.result.count,
        lastMonthCount: lastMonthCount.result.count
    }
});

app.route.post("/admin/assetsOverviewStatistics", async function(req){
    var assetTypes = await new Promise((resolve)=>{
        let sql = `select companys.assetType, count(*) as count from companys group by companys.assetType order by companys.assetType asc;`;
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

    assetTypes = assetTypes.result

    for(i in assetTypes){
        var dapps = await app.model.Company.findAll({
            condition: {
                assetType: assetTypes[i].assetType
            },
            fields: ['dappid']
        });
        var sum = 0;
        var offline = 0;
        var sumOfRegistered = 0;
        for(j in dapps){
            try{
            var totalIssued = await dappCall.call('POST', '/api/dapps/' + dapps[j].dappid + '/admin/workDetails', {});
            }catch(err){
                offline++;
                continue;
            }
            if(!totalIssued || !totalIssued.isSuccess){
                offline++;
                continue;
            }
            sum += totalIssued.issuesCount;
            sumOfRegistered += totalIssued.recepientsCount;
        }
        assetTypes[i].totalCertificatesIssued = sum;
        assetTypes[i].totalInUse = dapps.length - offline;
        assetTypes[i].totalRecepients = sumOfRegistered;
    }
    return {
        isSuccess: true,
        assetTypes: assetTypes
    }
});

app.route.post("/admin/assetSpecificOverviewStatistics", async function(req){
    if(!req.query.assetType) return {
        isSuccess: false,
        message: "Please provide an assetType"
    }
    var dapps = await new Promise((resolve)=>{
        let sql = `select mappings.email, companys.timestampp, companys.dappid from companys join mappings on companys.dappid = mappings.dappid and role = 'superuser' where companys.assetType = ?;`;
        app.sideChainDatabase.all(sql, [req.query.assetType], (err, row)=>{
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
    dapps = dapps.result;
    for(i in dapps){
        try{
        var details = await dappCall.call('POST', '/api/dapps/' + dapps[i].dappid + '/admin/workDetails', {});
        }catch(err){
            dapps[i].offline = true;
            continue;
        }
        if(!details || !details.isSuccess) {
            dapps[i].offline = true;
            continue;
        }
        dapps[i].issuersCount = details.issuersCount;
        dapps[i].authorizersCount = details.authorizersCount;
        dapps[i].recepientsCount = details.recepientsCount;
        dapps[i].issuesCount = details.issuesCount;
    }
    return {
        isSuccess: true,
        dapps: dapps
    }
});

app.route.post('/setPaymentRules', async function(req){
    if(!req.query.paymentMode || !req.query.paymentGateway) return {
        isSuccess: false,
        message: "Please provide paymenMode and paymentGateway values"
    }
    var create = {
        paymentMode: req.query.paymentMode,
        paymentGateway: req.query.paymentGateway,
        deleted: '0'
    }
    var error = {
        isSuccess: false,
        message: "Same rule already exists"
    }
    if(req.query.assetType){
        create.assetType=req.query.assetType;
        create.country = req.query.country || '-';

        let exists = await app.model.Apm.exists(create);
        if(exists) return  error;

        app.sdb.create('apm', create);
    } else if(req.query.country){
        create.country = req.query.country;
        
        let exists = await app.model.Cpm.exists(create);
        if(exists) return error;

        app.sdb.create('cpm', create);
    } else if (req.query.dappid){
        create.dappid = req.query.dappid;

        let exists = await app.model.Dpm.exists(create);
        if(exists) return error;

        app.sdb.create('dpm', create);
    } else return {
        isSuccess: false,
        message: "Need to specify dappid or assetType or country to set rule"
    }
    return {
        isSuccess: true
    }
})

app.route.post('/getPaymentRule', async function(req){
    var dapp = await app.model.Company.findOne({
        condition: {
            name: req.query.name
        }
    });
    if(!dapp) return {
        isSuccess: false,
        message: "Dapp not found"
    }

    function setValues(obj){
        return {
            isSuccess: true,
            paymentMode: obj.paymentMode,
            paymentGateway: obj.paymentGateway
        }
    }

    var dpm = await app.model.Dpm.findOne({
        condition: {
            dappid: dapp.dappid,
            deleted: '0'
        }
    });
    if(dpm) return setValues(dpm);

    var apmc = await app.model.Apm.findOne({
        condition: {
            assetType: dapp.assetType,
            country:  dapp.country
        }
    });
    if(apmc) return setValues(apmc);

    var apm = await app.model.Apm.findOne({
        condition: {
            assetType: dapp.assetType
        }
    })
    if(apm) return setValues(apm);

    var cpm = await app.model.Cpm.findOne({
        condition: {
            country: dapp.country
        }
    })
    if(cpm) return setValues(cpm);

    return {
        isSuccess: false,
        message: "No payment rule defined"
    }
})

app.route.post("/setTransactionRule", async function(req) {
    if(!req.query.serviceFee) return {
        isSuccess: false,
        message: "Please provide serviceFee value"
    }
    var create = {
        deleted: '0'
    }
    
    if(req.query.assetType){
        create.assetType=req.query.assetType;
        create.country = req.query.country || '-';

        let find = await app.model.Atm.findOne({
            condition: create
        });
        if(find) {
            app.sdb.update('atm', {
                serviceFee: req.query.serviceFee
            }, create);
        } else {
            create.serviceFee = req.query.serviceFee;
            app.sdb.create('atm', create);
        }
    } else if(req.query.country){
        create.country = req.query.country;
        
        let find = await app.model.Ctm.findOne({
            condition: create
        });
        if(find) {
            app.sdb.update('ctm', {
                serviceFee: req.query.serviceFee
            }, create);
        } else {
            create.serviceFee = req.query.serviceFee;
            app.sdb.create('ctm', create);
        }
    } else if (req.query.dappid){
        create.dappid = req.query.dappid;

        let find = await app.model.Dtm.findOne({
            condition: create
        });
        if(find) {
            app.sdb.update('dtm', {
                serviceFee: req.query.serviceFee
            }, create);
        } else {
            create.serviceFee = req.query.serviceFee;
            app.sdb.create('dtm', create);
        }
    } else return {
        isSuccess: false,
        message: "Need to specify dappid or assetType or country to set rule"
    }

    await blockWait();
    return {
        isSuccess: true
    }
})

app.route.post("/getTransactionRule", async function(req){
    var dapp = await app.model.Company.findOne({
        condition: {
            name: req.query.name
        }
    });
    if(!dapp) return {
        isSuccess: false,
        message: "Dapp not found"
    }
    return await module.exports.getCharge(dapp);
})

module.exports.getCharge = async function(dapp){
    function setValues(obj){
        return {
            isSuccess: true,
            serviceFee: obj.serviceFee
        }
    }

    var dpm = await app.model.Dtm.findOne({
        condition: {
            dappid: dapp.dappid,
            deleted: '0'
        }
    });
    if(dpm) return setValues(dpm);

    var apmc = await app.model.Atm.findOne({
        condition: {
            assetType: dapp.assetType,
            country:  dapp.country
        }
    });
    if(apmc) return setValues(apmc);

    var apm = await app.model.Atm.findOne({
        condition: {
            assetType: dapp.assetType
        }
    })
    if(apm) return setValues(apm);

    var cpm = await app.model.Ctm.findOne({
        condition: {
            country: dapp.country
        }
    })
    if(cpm) return setValues(cpm);

    return {
        isSuccess: true,
        serviceFee: "0"
    }
}

app.route.post("/admin/add", async function(req){
    if(!(req.query.name && req.query.role && req.query.email && req.query.password)) return {
        isSuccess: false,
        message: "Details missing"
    }
    var exists = await app.model.Admin.findOne({
        condition: {
            email: req.query.email,
            deleted: '0'
        }
    });
    if(exists) return {
        isSuccess: false,
        message: "Email already registered as an admin with AdminId: " + exists.adminid
    }
    var passwordHash = util.getHash(req.query.password);
    passwordHash = passwordHash.toString('base64');
    app.sdb.create('admin', {
        adminid: app.autoID.increment('admins_max_adminid'),
        name: req.query.name,
        role: req.query.role,
        email: req.query.email,
        passwordHash: passwordHash,
        // privilegesView: req.query.privilegesView,
        // privilegesEdit: req.query.privilegesEdit,
        // privilegesAdd: req.query.privilegesAdd,
        // privilegesDelete: req.query.privilegesDelete,
        timestampp: new Date().getTime(),
        deleted: '0'
    });
    await blockWait();
    return {
        isSuccess: true
    }
});

app.route.post("/admin/delete", async function(req){
    if(!req.query.adminid) return {
        isSuccess: false,
        message: "Please provide an AdminId"
    }
    var exists = await app.model.Admin.exists({
        adminid: req.query.adminid,
        deleted: '0'
    });
    if(!exists) return {
        isSuccess: false,
        message: "Admin does not exist"
    }
    app.sdb.update('admin', {
        deleted: '1'
    },{
        adminid: req.query.adminid
    });
    await blockWait();
    return {
        isSuccess: true
    }
})

app.route.post('/admins', async function(req){
    var condition = {
        deleted: '0'
    }
    var total = await app.model.Admin.count(condition)
    var admins = await app.model.Admin.findAll({
        condition: condition,
        fields: ['adminid', 'name', 'email', 'timestampp', 'role'],
        limit: req.query.limit,
        offset: req.query.offset
    });
    return {
        isSuccess: true,
        total: total,
        admins: admins
    }
});

app.route.post('/admin/search', async function(req){
    var condition = {};
    if(req.query.email){
        condition.email = {
            $like: "%" + req.query.email + "%"
        }
    } else if (req.query.name){
        condition.name = {
            $like: "%" + req.query.name + "%"
        }
    } else return {
        isSuccess: false,
        message: "Please pass either email or name to search"
    }
    condition.deleted = '0';
    var admin = await app.model.Admin.findAll({
        condition: condition,
        fields: ['adminid', 'name', 'role', 'email', 'timestampp']
    });
    return {
        isSuccess: true,
        admin: admin
    }
});

app.route.post('/admin/login', async function(req){
    if(!(req.query.email && req.query.password)) return {
        isSuccess: false,
        message: "Email or password missing"
    }
    var passwordHash = util.getHash(req.query.password);
    passwordHash = passwordHash.toString('base64');
    var admin = await app.model.Admin.findOne({
        condition: {
            email: req.query.email,
            passwordHash: passwordHash,
            deleted: '0'
        }
    });
    if(!admin) return {
        isSuccess: false,
        message: "Invalid credentials"
    }
    delete admin.passwordHash;
    return {
        isSuccess: true,
        admin: admin
    }
});

app.route.post('/admin/geDappNamesIds', async function(req){
    var dappids = await app.model.Company.findAll({
        fields: ['dappid', 'name']
    });
    var result = {}
    for(i in dappids){
        result[dappids[i].name] = dappids[i].dappid
    }
    return {
        isSuccess: true,
        dapps: result
    }
});

app.route.post('/admin/assetType/getDapps', async function(req){
    if(!req.query.assetType) return {
        isSuccess: false,
        message: "Please provide assetType"
    }

    var dapps = await new Promise((resolve)=>{
        let sql = `select companys.dappid, companys.name, mappings.email from companys join mappings on companys.dappid = mappings.dappid and mappings.role = 'superuser' where companys.assetType = ?`;
        app.sideChainDatabase.all(sql, [req.query.assetType], (err, row)=>{
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

    if(!dapps.isSuccess) return dapps;
    
    return {
        isSuccess: true,
        dapps: dapps.result
    }
});

app.route.post('/admin/getIncomes', async function(req){
    var dapps = await app.model.Company.findAll({
        fields: ['dappid']
    });
    console.log(dapps)
    var adminEarnings = 0;
    var ownerEarnings = 0;
    var transactionFeesEarned = 0;
    for(i in dapps){
        try{

        var response = await dappCall.call('POST', `/api/dapps/` + dapps[i].dappid + `/admin/incomes`, {});

        } catch(err){
            continue;
        }
        if(!response) continue;
        adminEarnings += response.adminEarnings;
        ownerEarnings += response.ownerEarnings;
        transactionFeesEarned += response.transactionFeesEarned;
    }

    return {
        isSuccess: true,
        adminEarnings: adminEarnings,
        ownerEarnings: ownerEarnings,
        transactionFeesEarned: transactionFeesEarned
    }
});
