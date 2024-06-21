import amqp from "amqplib/callback_api.js";
import { UsernameDTO } from "../types/users";
import { ReviewService } from "../services/review-service";

export class EventQueue {
    private rabbit;
    constructor(private reviewService: ReviewService) {
        this.rabbit = amqp;
        this.init();
    }

    execute(payload: any, channelName: string) {
        this.rabbit.connect(`amqp://${process.env.RABBITMQ_USERNAME}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}/`, function(error, connection) {
            if (error) {
                return;
                //throw error;
            }

        connection.createChannel(function (error1, channel) {
                if (error1) {
                    throw error1;
                }

                var data = JSON.stringify(payload);
                channel.assertQueue(channelName, {
                    durable: false
                });

                channel.sendToQueue(channelName, Buffer.from(data));
            });
        });
    };

    private init() {
        amqp.connect(`amqp://${process.env.RABBITMQ_USERNAME}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}/`, (error, connection) => {
            if (error) {
                return;
                //throw error;
            }

            connection.createChannel((error1, channel) => {
                if (error1) {
                    throw error1;
                }

                const exchangeName = 'username-updated';
                channel.assertExchange(exchangeName, 'fanout', { durable: true });
    
                channel.assertQueue('', { exclusive: true }, (error2, q) => {
                    if (error2) {
                        throw error2;
                    }
    
                    channel.bindQueue(q.queue, exchangeName, '');
    
                    console.log(`Waiting for messages in ${q.queue}. To exit press CTRL+C`);
    
                    channel.consume(q.queue, (payload) => {
                        console.log(`Updating username: ${payload}`);
                        if (payload !== null) {
                            const usernames: UsernameDTO = JSON.parse(payload.content.toString());
                            console.log(`Updating username: ${JSON.stringify(usernames)}`);
                            this.reviewService.updateUsername(usernames);
                        }
                    }, { noAck: true });
                });

                const exchangeNameDelete = 'user-deleted';
                channel.assertExchange(exchangeNameDelete, 'fanout', { durable: true });
    
                channel.assertQueue('', { exclusive: true }, (error2, q) => {
                    if (error2) {
                        throw error2;
                    }
    
                    channel.bindQueue(q.queue, exchangeNameDelete, '');
    
                    console.log(`Waiting for messages in ${q.queue}. To exit press CTRL+C`);
    
                    channel.consume(q.queue, (payload) => {
                        console.log(`Deleting entities that have username: ${payload}`);
                        if (payload !== null) {
                            const username: string= JSON.parse(payload.content.toString()).username;
                            console.log(`Deleting entities with username: ${JSON.stringify(username)}`);
                            this.reviewService.deleteUser(username);
                        }
                    }, { noAck: true });
                });

            });
        });
    }
}