'use strict';

module.exports.get = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'make api call to shopify get products we need to send access token here',
        input: event,
      },
      null,
      2
    ),
  };
};
