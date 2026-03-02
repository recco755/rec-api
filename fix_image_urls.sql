USE recommendo;

UPDATE services 
SET carousel_image_1 = REPLACE(carousel_image_1, 'ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com', '13.212.181.108')
WHERE carousel_image_1 LIKE '%ec2-54-251-142-179%';

UPDATE services 
SET carousel_image_2 = REPLACE(carousel_image_2, 'ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com', '13.212.181.108')
WHERE carousel_image_2 LIKE '%ec2-54-251-142-179%';

UPDATE services 
SET carousel_image_3 = REPLACE(carousel_image_3, 'ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com', '13.212.181.108')
WHERE carousel_image_3 LIKE '%ec2-54-251-142-179%';

UPDATE services 
SET business_icon = REPLACE(business_icon, 'ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com', '13.212.181.108')
WHERE business_icon LIKE '%ec2-54-251-142-179%';