var dappCall = require("../utils/dappCall");

app.route.post('/user/dappid2', async function(req){
    req.query.email = (req.query.email)? req.query.email.toLowerCase(): null;
    var isNewUser = await app.model.Mapping.exists({
        email: req.query.email
    })
    if(!isNewUser) {
        var saved = await app.model.Newuser.exists({
            email: req.query.email
        });
        if(!saved){
            app.sdb.create('newuser', {
                email: req.query.email,
                timestampp: new Date().getTime()
            });
        }
        return {
            role: 'new user',
            isSuccess: true
        }
    }

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (select mappings.dappid, mappings.role, companys.company, companys.name, companys.assetType from mappings join companys on companys.dappid = mappings.dappid where mappings.email = ? and mappings._deleted_ = 0);`;
        app.sideChainDatabase.get(sql, [req.query.email], (err, row)=>{
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

    var dapps = await new Promise((resolve)=>{
        let sql = `select mappings.dappid, mappings.role, companys.company, companys.name, companys.assetType from mappings join companys on companys.dappid = mappings.dappid where mappings.email = ? and mappings._deleted_ = 0 order by mappings.timestampp desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.email, req.query.limit || 20, req.query.offset || 0], (err, row)=>{
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

    for(i in dapps.result){
        try{
        var response = await dappCall.call('GET', '/api/dapps/' + dapps.result[i].dappid + '/isLaunched', {});
        } catch(err){
            dapps.result[i].launched = false;
        }
        if(!response) dapps.result[i].launched = false;
        else dapps.result[i].launched = response.isSuccess;
    }

    return {
        total: total.result.count,
        dapps: dapps.result
    }
});

app.route.post('/user/getDappsByAddress2', async function(req){

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (select issueaddrs.dappid, companys.company, companys.assetType from issueaddrs join companys on companys.dappid = issueaddrs.dappid where issueaddrs.address = ? and issueaddrs.deleted = '0');`;
        app.sideChainDatabase.get(sql, [req.query.address], (err, row)=>{
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

    var dapps = await new Promise((resolve)=>{
        let sql = `select issueaddrs.dappid, companys.company, companys.assetType from issueaddrs join companys on companys.dappid = issueaddrs.dappid where issueaddrs.address = ? and issueaddrs.deleted = '0' order by issueaddrs.timestampp desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.address, req.query.limit || 20, req.query.offset || 0], (err, row)=>{
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
        total: total.result.count,
        dapps: dapps.result
    }
});

app.route.post('/allAssetTypes', async function(req) {
    var total = await new Promise((resolve)=>{
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

    var dapps = await new Promise((resolve)=>{
        let sql = `select distinct companys.assetType from companys limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.limit || 20, req.query.offset || 0], (err, row)=>{
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

    var types = [];

    for(i in dapps.result){
        types.push(dapps.result[i].assetType);
    }

    return {
        total: total.result.count,
        dapps: types
    }
})

app.route.post('/user/assetType/dapps', async function(req) {
    if(!(req.query.assetType && req.query.address)) return {
        isSuccess: false,
        message: "AssetType or address missing"
    }
    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (select issueaddrs.dappid from issueaddrs join companys on companys.dappid = issueaddrs.dappid and companys.assetType = ? where issueaddrs.address = ?);`;
        app.sideChainDatabase.get(sql, [req.query.assetType, req.query.address], (err, row)=>{
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

    var dapps = await new Promise((resolve)=>{
        let sql = `select issueaddrs.dappid from issueaddrs join companys on companys.dappid = issueaddrs.dappid and companys.assetType = ? where issueaddrs.address = ? order by issueaddrs.timestampp desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, [req.query.assetType, req.query.address, req.query.limit || 20, req.query.offset || 0], (err, row)=>{
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

    var dappArray = [];
    for(i in dapps.result){
        dappArray.push(dapps.result[i].dappid);
    }

    return {
        total: total.result.count,
        dapps: dappArray
    }
})

app.route.post('/user/assetTypes', async function(req){
    var dapps = await new Promise((resolve)=>{
        let sql = `select distinct companys.assetType from issueaddrs join companys on companys.dappid = issueaddrs.dappid where issueaddrs.address = ? order by issueaddrs.timestampp desc;`;
        app.sideChainDatabase.all(sql, [req.query.address], (err, row)=>{
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
        assetTypes: dapps.result
    }
});

app.route.post('/address/assetType/dapps', async function(req){
    var condition = `select issueaddrs.dappid, companys.company, companys.name as dappName, companys.assetType from issueaddrs join companys on companys.dappid = issueaddrs.dappid where issueaddrs.deleted = '0'`;
    if(!(req.query.address || req.query.assetType)) return {
        isSuccess: false,
        message: "Please provide address or assetType or both"
    }
    var input = [];
    if(req.query.address){
        condition += ` and issueaddrs.address = ?`;
        input.push(req.query.address);
    }
    if(req.query.assetType){
        condition += ` and companys.assetType = ?`;
        input.push(req.query.assetType);
    }

    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from (${condition});`;
        app.sideChainDatabase.get(sql, input, (err, row)=>{
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

    input.push(req.query.limit || 20, req.query.offset || 0);

    var dapps = await new Promise((resolve)=>{
        let sql = `${condition} order by issueaddrs.timestampp desc limit ? offset ?;`;
        app.sideChainDatabase.all(sql, input, (err, row)=>{
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
        total: total.result.count,
        dapps: dapps.result
    }
})

app.route.post('/getlist', async function(req){
    var dapps = await new Promise((resolve)=>{
        let sql = `select companys.country, companys.assetType, companys.name as dappName from companys;`;
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

    if(!dapps.isSuccess) return dapps;

    return {
        dapps: dapps.result
    }
})

app.route.post("/recentlyRechargedDapps", async function(req){
    var dapps = await new Promise((resolve)=>{
        let sql = `select mappings.email, companys.name, companys.dappid, recharges.address, recharges.timestampp from recharges join mappings on recharges.dappid = mappings.dappid join companys on recharges.dappid = companys.dappid order by recharges.timestampp desc limit ?;`;
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

    if(!dapps.isSuccess) return dapps;

    for(i in dapps.result){
        try{
        var response = await dappCall.call('GET', '/api/dapps/' + dapps.result[i].dappid + '/rechargeDetails', {});
        }catch(err) {
            console.log(JSON.stringify(err));
        }
        if(!(response && response.success)) {
            dapps.result[i].dappBalance = '-';
            dapps.result[i].issuedCount = '-';
            continue;
        }
        dapps.result[i].dappBalance = response.superUserBalance;
        dapps.result[i].issuedCount = response.issuedCount;
    }
    return {
        dapps: dapps.result
    }
})

app.route.post('/campaignApi1', async function(req){
    var total = await new Promise((resolve)=>{
        let sql = `select count(*) as count from companys;`;
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

    var assets = await new Promise((resolve)=>{
        let sql = `select companys.assetType, count(*) as countofDapps from companys group by companys.assetType;`;
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

    return {
        isSuccess: true,
        dappsCount: total.result.count,
        assets: assets.result
    }
});

app.route.post('/campaignApi2', async function(req){
    var count = await app.model.Mapping.count({
        email: req.query.email,
        role: 'superuser'
    });
    return {
        isSuccess: true,
        count: count
    }
});

app.route.post('/campaignApi3', async function(req){
    var newUser = await app.model.Newuser.findOne({
        condition: {
            email: req.query.email
        }
    });
    if(!newUser) return {
        isSuccess: false,
        message: "Not a new user"
    }
    var timestampp = new Date().getTime();
    return {
        isSuccess: true,
        time: timestampp - newUser.timestampp
    }
});
