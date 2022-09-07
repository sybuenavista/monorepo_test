'use strict';

module.exports.integrations = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'get all integrations here',
        input: event,
      },
      null,
      2
    ),
  };
};
