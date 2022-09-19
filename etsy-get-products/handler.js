'use strict';
var axios = require('axios');
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
//serverless invoke local --function getProducts --data '{"store_id" : 64}'
module.exports.get = async (event, context) => {

	let encryptor = new Encryptor({key: process.env.LARAVEL_API_KEY});
	

	//return error if no store_id
	if(typeof event.store_id === 'undefined') {
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
	let store = await mysql.query('SELECT * FROM stores WHERE id = '+event.store_id);
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

	let integration = await mysql.query('SELECT * FROM integration_etsy WHERE store_id = '+event.store_id)
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
	await mysql.end();
	// var params = JSON.parse(event);
	//decryt access_token
	var access_token = encryptor.decrypt(integration[0].access_token);
	var storeUrl = store[0].url;
	var url = storeUrl+'/admin/api/2022-07/products.json';
	// console.log(storeUrl)
	// console.log(access_token)
	//add filter on getting products based on updated date so we dont need to pull everything
	await axios({
		method: 'get',
		url: url,
		headers: { 
		  'Content-Type': 'application/json', 
		  'X-Shopify-Access-Token': access_token, 
		}
	}).then(async function (response) {
		console.log(response.data)
		//we need to call bagisto now to save the data
		//console.log(JSON.stringify(response.data));
		await saveRaw(response.data, store[0].id, store[0].customer_id)
	}).catch(function (error) {
		console.log(error);
	});


	 // Return the results
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

async function saveRaw(products, storeId, customerId) {
	
	var url = 'http://127.0.0.1:8000/serverless-api/shopify/saveRaw';
	var data = JSON.stringify({
		'products': products.products,
		'store_id' : storeId,
		'customer_id' : customerId
	});
	await axios({
		method: 'post',
		url: url,
		headers: { 
		  'Content-Type': 'application/json', 
		},
		data:data
	}).then(async function (response) {
		console.log(response.data)
		//we need to call bagisto now to save the data
		//console.log(JSON.stringify(response.data));
		//await saveRaw(response.data, store[0].id, store[0].customer_id)
	}).catch(function (error) {
		console.log(error);
	});

}
