'use strict';
var axios = require('axios');
var qs = require('qs');
const { access } = require('fs');
const mysql = require('serverless-mysql')({
	config: {
		host     : process.env.DB_HOST,
		database : process.env.DB_DATABASE,
		user     : process.env.DB_USERNAME,
		password : process.env.DB_PASSWORD
	}
})

const {Encryptor} = require('node-laravel-encryptor');
//run local 
//serverless invoke local --function getProducts  --param="store_id=4"
module.exports.get = async (event, context) => {

	let encryptor = new Encryptor({key: process.env.LARAVEL_API_KEY});
	var storeId = process.env.STORE_ID;
	//console.log(storeId);
	//return error if no store_id
	if(typeof storeId === 'undefined') {
		return {
			statusCode: 200,
			body: JSON.stringify({message: 'store_id is required', error :  true},
			null,
			2
			),
		};
	}
	//at this point, we know there is store_id
	//we need to get integration_shopify to get access_token and store name
	let store = await mysql.query('SELECT * FROM stores WHERE id = '+storeId);
	//return if not found
	if(store.length == 0) {
		return {
			statusCode: 200,
			body: JSON.stringify({message: 'store_not_found', error :  true},
			null,
			2
			),
		};
	}

	let integration = await mysql.query('SELECT * FROM integration_etsy WHERE store_id = '+storeId)
	//return if not found
	if(integration.length == 0) {
		return {
			statusCode: 200,
			body: JSON.stringify({message: 'no_shopify_integration', error :  true},
			null,
			2
			),
		};
	}

	// Run clean up function
	
	var shopId = integration[0].etsy_shop_id;
	//console.log(integration); 
	//return false;
	// var params = JSON.parse(event);
	//decryt access_token
	//console.log(integration[0].access_token);
	var clientId = process.env.ETSY_API_KEY;
	
	var accessToken = encryptor.decrypt(integration[0].access_token);
	var refreshToken = encryptor.decrypt(integration[0].refresh_token);
	//1st step is renew the access_token using refresh_token
	var newToken = await requestNewToken(refreshToken, clientId);
	//console.log(newToken);

	if(typeof newToken.access_token !== 'undefined') {
		var encryptedAccessToken = encryptor.encryptSync(newToken.access_token);
		var encryptedRefreshToken = encryptor.encryptSync(newToken.refresh_token);

		let update = await mysql.query('UPDATE integration_etsy SET access_token = "'+encryptedAccessToken+'" , refresh_token = "'+encryptedRefreshToken+'" WHERE store_id = '+storeId)
	}

	await mysql.end();
	var url = 'https://openapi.etsy.com/v3/application/shops/'+shopId+'/listings?includes=Inventory,Images';

	
	var headers = { 
		'Content-Type': 'application/json', 
		'Authorization': 'Bearer '+newToken.access_token, 
		'x-api-key' : clientId
	};
	
	//add filter on getting products based on updated date so we dont need to pull everything
	await axios({
		method: 'get',
		url: url,
		headers: headers
	}).then(async function (response) {
		//console.log(response.data)
		//we need to call bagisto now to save the data together with new token
		//console.log(JSON.stringify(response.data));
		await saveRaw(response.data, store[0].id, store[0].customer_id)
	}).catch(function (error) {
		console.log(error);
	});
	
	//return results
	return {
		statusCode: 200,
		body: JSON.stringify(
		{
			message: 'BOOM panis',
			//result : results,
			input: event,
		},
		null,
		2
		),
	};
};

async function requestNewToken(refreshToken, clientId) {
	
	var url = 'https://api.etsy.com/v3/public/oauth/token';
	// console.log(storeUrl)
	// console.log(access_token)
	var data = qs.stringify({
		'grant_type': 'refresh_token',
		'client_id': clientId,
		'refresh_token': refreshToken 
	});
	
	//add filter on getting products based on updated date so we dont need to pull everything
	return axios({
		method: 'post',
		url: url,
		headers: { 
		  'Content-Type': 'application/x-www-form-urlencoded', 
		},
		data : data
	}).then(async function (response) {
		console.log('WTF', response.data)
		return response.data;
	}).catch(function (error) {
		console.log(error);
		return error
	});
}

async function saveRaw(products, storeId, customerId) {
	
	var url = 'http://127.0.0.1:8000/serverless-api/etsy/saveRaw';
	var data = JSON.stringify({
		'products': products.results,
		'store_id' : storeId,
		'customer_id' : customerId,
	});
	console.log(url)
	await axios({
		method: 'post',
		url: url,
		headers: { 
		  'Content-Type': 'application/json', 
		},
		data:data
	}).then(async function (response) {
		console.log(response.data)
	}).catch(function (error) {
		console.log(error);
	});

}
