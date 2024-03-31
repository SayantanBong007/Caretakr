const bcrypt = require("bcryptjs");
const prisma = new (require("@prisma/client").PrismaClient)();
const { z } = require("zod");
const axios = require("axios");

const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/errorHandler");
const sendToken = require("../utils/jwtToken");

exports.registerUser = catchAsyncErrors(async (req, res, next) => {
  if (req.body.googleAccessToken) {
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${req.body.googleAccessToken}`,
        },
      }
    );

    const email = response.data.email;
    const name = response.data.name;
    const profile_pic = response.data.picture;

    const alreadyExistUser = await prisma.user.findUnique({ where: { email } });
    if (alreadyExistUser) {
      return next(new ErrorHandle("User already exists", 400));
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        profile_pic,
      },
    });

    sendToken(newUser, 201, res);
  } else {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().min(1),
      password: z.string().min(8),
      gender: z.string().min(1),
      country: z.string().min(1),
      height: z.number().minValue(1),
      weight: z.number().minValue(1),
      bloodGroup: z.string().min(1),
      userRole: z.string().min(1),
      maritalStatus: z.string().min(1),
      profile_pic: z.string().min(1),
    });

    const safeParseResult = schema.safeParse(req.body);
    if (safeParseResult.error)
      return next(new ErrorHandler(safeParseResult.error, 400));

    const { user } = req.body;

    const userExist = prisma.user.findUnique({
      where: {
        email: user.email,
      },
    });

    if (userExist) return next(new ErrorHandle("User already exists", 400));

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);

    const newUser = await prisma.user.create({
      data: {
        ...user,
        password: hashedPassword,
      },
    });

    sendToken(newUser, 201, res);
  }
});

exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  if (req.body.googleAccessToken) {
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${req.body.googleAccessToken}`,
        },
      }
    );
    const email = response.data.email;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new ErrorHandler( "User doesn't exist" , 400));

    sendToken(user, 200, res);

  } else {
    
    const schema = z.object({
      email: z.string().min(1),
      password: z.string().min(1),
    });

    const safeParseResult = schema.safeParse(req.body);
    if (safeParseResult.error)
      return next(new ErrorHandler(safeParseResult.error, 400));

    const { email, password } = req.body;

    const user = await prisma.user.findFirst({ where: { email: email } });
    console.log(user);
    if (!user) return next(new ErrorHandler("Invalid email or password", 401));

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched)
      return next(new ErrorHandler("Invalid email or password", 401));

    sendToken(user, 200, res);
  }
});

exports.logoutUser = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});
