const admin = require('../config/firebaseConfig').admin;

module.exports = {

    sendMessage: async (message) =>  {

        const registrationToken = 'eJ6zc8b2akhWmGybpHVA9X:APA91bFsyAazy0i6NIiVFwPyJBhAnEKdTMLZ1O3fworKWdoazJ6PsQPqWwVxYm_A979YwpkjU8hV9cTs6aucsW_ZAWv5sQjDHC1_0iX91ouT06mSPZCyDbBQskYeeMpHa0KjYsQwtXV-';
        console.log(message, "push function ......................");
        // const new_message = {
        //         data: {
        //             score: '850',
        //             time: '2:45'
        //         },
        //         token: registrationToken
        // };
        // const options = {
        //     priority: 'high',
        //     timeToLive: 60 * 60 * 24
        // }
        // console.log(message);
        // Send a message to the device corresponding to the provided
        // registration token.
        admin.messaging().send(message)
        .then((response) => {
            // Response is a message ID string.
            console.log(response);
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });

    }

}